const express = require('express');

async function queryProducts(db, { category, q } = {}) {
    const conditions = ['is_available = 1'];
    const params = [];

    if (category && category !== 'all') {
        conditions.push('category = ?');
        params.push(category);
    }

    if (q && q.trim()) {
        conditions.push('(LOWER(name) LIKE ? OR LOWER(description) LIKE ?)');
        const pattern = `%${q.trim().toLowerCase()}%`;
        params.push(pattern, pattern);
    }

    const sql = `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY id ASC`;
    return db.all(sql, params);
}

function createProductsRouter(db) {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            const { category, q } = req.query;
            const products = await queryProducts(db, { category, q });
            res.json({ products });
        } catch (err) {
            next(err);
        }
    });

    return router;
}

module.exports = { createProductsRouter, queryProducts };
