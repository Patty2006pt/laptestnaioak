const path = require('path');
const express = require('express');
const session = require('express-session');

const { createDatabase } = require('./src/db');
const { SQLiteSessionStore } = require('./src/sessionStore');
const { attachSessionLocals } = require('./src/middleware/auth');
const { createPagesRouter } = require('./src/routes/pages');
const { createAuthRouter } = require('./src/routes/auth');
const { createProductsRouter } = require('./src/routes/products');
const { createCartRouter } = require('./src/routes/cart');

async function createApp(options = {}) {
    const db = createDatabase(options.dbPath);
    await db.init();

    const sessionStore = new SQLiteSessionStore(db, {
        cleanupIntervalMs: options.sessionCleanupIntervalMs
    });

    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
        session({
            secret: process.env.SESSION_SECRET || 'foodhub-dev-session-secret',
            store: sessionStore,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production'
            }
        })
    );

    app.use(attachSessionLocals);

    app.use('/', createPagesRouter(db));
    app.use('/api/auth', createAuthRouter(db));
    app.use('/api/products', createProductsRouter(db));
    app.use('/api/cart', createCartRouter(db));

    app.use((err, req, res, _next) => {
        console.error(err);
        if (req.path.startsWith('/api/')) {
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
        }
        return res.status(500).send('เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์');
    });

    async function close() {
        sessionStore.stopCleanup();
        await db.close();
    }

    return { app, db, sessionStore, close };
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 3000;
    createApp()
        .then(({ app }) => {
            app.listen(port, () => {
                console.log(`Food Hub server running at http://localhost:${port}`);
            });
        })
        .catch((err) => {
            console.error('Failed to start server:', err);
            process.exit(1);
        });
}

module.exports = { createApp };
