const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'foodhub.db');

const INITIAL_PRODUCTS = [
    {
        name: 'กระเพราหมูสับ',
        description: 'กระเพราหมูสับ รสชาติจัดจ้าน',
        category: 'spicy',
        price: 180,
        badge_text: 'เผ็ดจัดจ้าน',
        badge_class: 'bg-danger-subtle text-danger',
        image_url: '/assets/krapao.avif',
        calories: 550,
        protein: '25g',
        carbs: '40g',
        fat: '28g'
    },
    {
        name: 'แกงเขียวหวานไก่กะทิสด',
        description: 'พริกแกงทำเอง หอมกลิ่นเครื่องเทศ กะทิสดคั้นใหม่ทุกวัน',
        category: 'soup',
        price: 150,
        badge_text: 'ยอดนิยม',
        badge_class: 'bg-success-subtle text-success',
        image_url: '/assets/greencurry.jpeg',
        calories: 480,
        protein: '22g',
        carbs: '15g',
        fat: '30g'
    },
    {
        name: 'ผัดไทยกุ้งสดห่อไข่',
        description: 'เส้นจันทน์เหนียวนุ่ม ผัดซอสมะขามเข้มข้น ห่อด้วยไข่นุ่มๆ',
        category: 'stir',
        price: 130,
        badge_text: 'เผ็ดมาก',
        badge_class: 'bg-danger-subtle text-danger-emphasis',
        image_url: '/assets/padthai.jpeg',
        calories: 620,
        protein: '20g',
        carbs: '75g',
        fat: '24g'
    },
    {
        name: 'ต้มยำกุ้ง',
        description: 'ต้มยำกุ้งน้ำข้นรสชาติกลมกล่อม หอมสมุนไพรไทย',
        category: 'soup',
        price: 220,
        badge_text: 'แนะนำเชฟ',
        badge_class: 'bg-warning-subtle text-warning-emphasis',
        image_url: '/assets/tomyum.jpg',
        calories: 320,
        protein: '24g',
        carbs: '12g',
        fat: '18g'
    },
    {
        name: 'ส้มตำไทย',
        description: 'ส้มตำไทย รสชาติจัดจ้าน',
        category: 'spicy',
        price: 150,
        badge_text: 'ยอดนิยม',
        badge_class: 'bg-success-subtle text-success',
        image_url: '/assets/ส้มตำไทย_preview.jpg',
        calories: 180,
        protein: '5g',
        carbs: '35g',
        fat: '2g'
    },
    {
        name: 'ลาบหมู',
        description: 'ลาบหมู รสชาติจัดจ้าน',
        category: 'spicy',
        price: 150,
        badge_text: 'ยอดนิยม',
        badge_class: 'bg-success-subtle text-success',
        image_url: '/assets/larbmu.jpg',
        calories: 240,
        protein: '26g',
        carbs: '8g',
        fat: '12g'
    },
    {
        name: 'ข้าวเหนียวมะม่วง',
        description: 'ข้าวเหนียวมะม่วง รสชาติหวานมัน',
        category: 'dessert',
        price: 150,
        badge_text: 'ยอดนิยม',
        badge_class: 'bg-success-subtle text-success',
        image_url: '/assets/mangostickeyrice.jpg',
        calories: 450,
        protein: '6g',
        carbs: '82g',
        fat: '14g'
    },
    {
        name: 'น้ำอัญชัญ',
        description: 'น้ำอัญชัญ รสชาติหวานเย็น',
        category: 'dessert',
        price: 150,
        badge_text: 'ยอดนิยม',
        badge_class: 'bg-success-subtle text-success',
        image_url: '/assets/anther.jpg',
        calories: 120,
        protein: '0g',
        carbs: '30g',
        fat: '0g'
    }
];

function createDatabase(dbPath = process.env.DB_PATH || DEFAULT_DB_PATH) {
    if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const db = new sqlite3.Database(dbPath);

    function run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function onRun(err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    function get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    function all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    function close() {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async function init() {
        await run('PRAGMA foreign_keys = ON');

        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                badge_text TEXT NOT NULL,
                badge_class TEXT NOT NULL,
                image_url TEXT NOT NULL,
                calories INTEGER NOT NULL,
                protein TEXT NOT NULL,
                carbs TEXT NOT NULL,
                fat TEXT NOT NULL,
                is_available INTEGER NOT NULL DEFAULT 1
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                sess TEXT NOT NULL,
                expired INTEGER NOT NULL
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_price INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                unit_price INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);
    

        await run(`
            CREATE TABLE IF NOT EXISTS home_visitors (
                ip_address TEXT NOT NULL,
                visit_date TEXT NOT NULL,
                first_visited_at TEXT NOT NULL,
                last_visited_at TEXT NOT NULL,
                PRIMARY KEY (ip_address, visit_date)
            )
        `);

        const row = await get('SELECT COUNT(*) AS count FROM products');
        if (row.count === 0) {
            for (const product of INITIAL_PRODUCTS) {
                await run(
                    `INSERT INTO products (
                        name, description, category, price, badge_text, badge_class,
                        image_url, calories, protein, carbs, fat, is_available
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        product.name,
                        product.description,
                        product.category,
                        product.price,
                        product.badge_text,
                        product.badge_class,
                        product.image_url,
                        product.calories,
                        product.protein,
                        product.carbs,
                        product.fat
                    ]
                );
            }
        }
    }

    return { db, run, get, all, close, init };
}

module.exports = { createDatabase, INITIAL_PRODUCTS };
