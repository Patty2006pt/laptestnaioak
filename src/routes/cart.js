const express = require('express');
const { requireAuthApi, summarizeCart } = require('../middleware/auth');

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function createCartRouter(db) {
    const router = express.Router();
    router.use(requireAuthApi);

    router.get('/', (req, res) => {
        res.json(summarizeCart(req.session.cart));
    });

    router.post('/add', async (req, res, next) => {
        try {
            const productId = Number.parseInt(req.body.productId, 10);
            const quantity = req.body.quantity ? Number.parseInt(req.body.quantity, 10) : 1;

            if (!Number.isInteger(productId) || productId <= 0) {
                return res.status(400).json({ error: 'รหัสเมนูอาหารไม่ถูกต้อง' });
            }
            if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
                return res.status(400).json({ error: 'จำนวนรายการไม่ถูกต้อง' });
            }

            const product = await db.get(
                'SELECT id, name, price, image_url FROM products WHERE id = ? AND is_available = 1',
                [productId]
            );
            if (!product) {
                return res.status(404).json({ error: 'ไม่พบเมนูอาหารที่เลือก' });
            }

            const cart = Array.isArray(req.session.cart) ? [...req.session.cart] : [];
            const existing = cart.find((item) => item.productId === product.id);

            if (existing) {
                existing.quantity += quantity;
                existing.price = product.price;
                existing.name = product.name;
            } else {
                cart.push({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    imageUrl: product.image_url,
                    quantity
                });
            }

            req.session.cart = cart;
            await saveSession(req);

            return res.json(summarizeCart(cart));
        } catch (err) {
            return next(err);
        }
    });

    router.delete('/:productId', async (req, res, next) => {
        try {
            const productId = Number.parseInt(req.params.productId, 10);
            if (!Number.isInteger(productId) || productId <= 0) {
                return res.status(400).json({ error: 'รหัสเมนูอาหารไม่ถูกต้อง' });
            }

            const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
            const nextCart = cart.filter((item) => item.productId !== productId);
            req.session.cart = nextCart;
            await saveSession(req);

            return res.json(summarizeCart(nextCart));
        } catch (err) {
            return next(err);
        }
    });

    router.post('/checkout', async (req, res, next) => {
        const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
        if (cart.length === 0) {
            return res.status(400).json({ error: 'กรุณาเลือกอาหารก่อนทำการสั่งซื้อครับ' });
        }

        let inTransaction = false;
        try {
            const productIds = cart.map((item) => item.productId);
            const placeholders = productIds.map(() => '?').join(', ');
            const dbProducts = await db.all(
                `SELECT id, name, price FROM products WHERE id IN (${placeholders}) AND is_available = 1`,
                productIds
            );
            const productMap = new Map(dbProducts.map((p) => [p.id, p]));

            const verifiedItems = [];
            let totalPrice = 0;

            for (const item of cart) {
                const product = productMap.get(item.productId);
                if (!product) {
                    return res.status(400).json({ error: `เมนู "${item.name}" ไม่พร้อมให้บริการในขณะนี้` });
                }
                const lineTotal = product.price * item.quantity;
                totalPrice += lineTotal;
                verifiedItems.push({
                    productId: product.id,
                    name: product.name,
                    unitPrice: product.price,
                    quantity: item.quantity
                });
            }

            await db.run('BEGIN TRANSACTION');
            inTransaction = true;

            const createdAt = new Date().toISOString();
            const orderResult = await db.run(
                'INSERT INTO orders (user_id, total_price, status, created_at) VALUES (?, ?, ?, ?)',
                [req.session.user.id, totalPrice, 'confirmed', createdAt]
            );

            for (const item of verifiedItems) {
                await db.run(
                    `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
                     VALUES (?, ?, ?, ?, ?)`,
                    [orderResult.lastID, item.productId, item.name, item.unitPrice, item.quantity]
                );
            }

            await db.run('COMMIT');
            inTransaction = false;

            req.session.cart = [];
            await saveSession(req);

            return res.status(201).json({
                message: 'บันทึกคำสั่งซื้อเรียบร้อยแล้ว!',
                orderId: orderResult.lastID,
                totalPrice,
                items: verifiedItems,
                cart: summarizeCart([])
            });
        } catch (err) {
            if (inTransaction) {
                await db.run('ROLLBACK').catch(() => {});
            }
            return next(err);
        }
    });

    return router;
}

module.exports = { createCartRouter };
