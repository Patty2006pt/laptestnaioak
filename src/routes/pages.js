const express = require('express');
const { queryProducts } = require('./products');
const { extractClientIp, getVisitorStats, recordHomeVisit } = require('../visitorCounter');

function createPagesRouter(db) {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            const selectedCategory = typeof req.query.category === 'string' ? req.query.category : 'all';
            const searchQuery = typeof req.query.q === 'string' ? req.query.q : '';
            const [products, visitorStats] = await Promise.all([
                queryProducts(db, {
                    category: selectedCategory,
                    q: searchQuery
                }),
                recordHomeVisit(db, extractClientIp(req))
            ]);

            res.render('index', {
                activePage: 'home',
                products,
                selectedCategory,
                searchQuery,
                visitorStats
            });
        } catch (err) {
            next(err);
        }
    });

    router.get('/api/visitors', async (_req, res, next) => {
        try {
            const visitorStats = await getVisitorStats(db);
            res.json(visitorStats);
        } catch (err) {
            next(err);
        }
    });

    router.get('/login', (req, res) => {
        const mode = req.query.mode === 'register' ? 'register' : 'login';
        res.render('login', {
            activePage: 'login',
            mode
        });
    });

    router.get('/index.html', (req, res) => {
        res.redirect(301, '/');
    });

    router.get('/login.html', (req, res) => {
        const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.redirect(301, `/login${query}`);
    });

    return router;
}

module.exports = { createPagesRouter };
