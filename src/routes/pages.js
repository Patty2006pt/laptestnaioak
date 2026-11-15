const express = require('express');
const { queryProducts } = require('./products');

function createPagesRouter(db) {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            const selectedCategory = typeof req.query.category === 'string' ? req.query.category : 'all';
            const searchQuery = typeof req.query.q === 'string' ? req.query.q : '';
            const products = await queryProducts(db, {
                category: selectedCategory,
                q: searchQuery
            });

            res.render('index', {
                activePage: 'home',
                products,
                selectedCategory,
                searchQuery
            });
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
