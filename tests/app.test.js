const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const bcrypt = require('bcrypt');

const { createApp } = require('../server');

class TestClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookies = new Map();
    }

    _updateCookies(res) {
        const setCookies = typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : [];
        for (const header of setCookies) {
            const [pair] = header.split(';');
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) continue;
            const name = pair.slice(0, eqIdx).trim();
            const val = pair.slice(eqIdx + 1).trim();
            if (!val) {
                this.cookies.delete(name);
            } else {
                this.cookies.set(name, val);
            }
        }
    }

    _cookieHeader() {
        return Array.from(this.cookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }

    async request(pathname, options = {}) {
        const headers = { ...(options.headers || {}) };
        const cookie = this._cookieHeader();
        if (cookie) {
            headers.cookie = cookie;
        }
        let body = options.body;
        if (body && typeof body === 'object' && !(body instanceof Buffer)) {
            headers['content-type'] = 'application/json';
            body = JSON.stringify(body);
        }

        const res = await fetch(`${this.baseUrl}${pathname}`, {
            method: options.method || 'GET',
            headers,
            body,
            redirect: options.redirect || 'manual'
        });
        this._updateCookies(res);

        const contentType = res.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
            ? await res.json()
            : await res.text();

        return { status: res.status, headers: res.headers, body: payload };
    }
}

async function startTestServer(dbPath) {
    const appCtx = await createApp({ dbPath, sessionCleanupIntervalMs: 0 });
    const server = http.createServer(appCtx.app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return {
        ...appCtx,
        baseUrl: `http://127.0.0.1:${port}`,
        async stop() {
            await new Promise((resolve) => server.close(resolve));
            await appCtx.close();
        }
    };
}

test('Food Hub Express + EJS + SQLite integration flow', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foodhub-test-'));
    const dbPath = path.join(tempDir, 'test.db');

    let srv = await startTestServer(dbPath);
    t.after(async () => {
        if (srv) await srv.stop().catch(() => {});
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const client = new TestClient(srv.baseUrl);

    await t.test('renders products from SQLite on / and /api/products', async () => {
        const homeRes = await client.request('/');
        assert.equal(homeRes.status, 200);
        assert.match(homeRes.body, /กระเพราหมูสับ/);
        assert.match(homeRes.body, /ต้มยำกุ้ง/);
        assert.match(homeRes.body, /ข้าวเหนียวมะม่วง/);

        const apiRes = await client.request('/api/products');
        assert.equal(apiRes.status, 200);
        assert.equal(apiRes.body.products.length, 8);

        const soupRes = await client.request('/api/products?category=soup');
        assert.equal(soupRes.status, 200);
        assert.equal(soupRes.body.products.length, 2);

        const loginPageRes = await client.request('/login');
        assert.equal(loginPageRes.status, 200);
        assert.match(loginPageRes.body, /เข้าสู่ระบบ/);

        const registerModeRes = await client.request('/login?mode=register');
        assert.equal(registerModeRes.status, 200);
        assert.match(registerModeRes.body, /สมัครสมาชิกใหม่/);

        const redirectIndex = await client.request('/index.html');
        assert.equal(redirectIndex.status, 301);
        assert.equal(redirectIndex.headers.get('location'), '/');

        const redirectLogin = await client.request('/login.html?mode=register');
        assert.equal(redirectLogin.status, 301);
        assert.equal(redirectLogin.headers.get('location'), '/login?mode=register');

        const cssRes = await client.request('/css/style.css');
        assert.equal(cssRes.status, 200);
        const jsRes = await client.request('/js/auth.js');
        assert.equal(jsRes.status, 200);
    });

    await t.test('blocks cart operations when unauthenticated', async () => {
        const res = await client.request('/api/cart/add', {
            method: 'POST',
            body: { productId: 1, quantity: 1 }
        });
        assert.equal(res.status, 401);
    });

    await t.test('registers user with bcrypt hash and creates SQLite session', async () => {
        const res = await client.request('/api/auth/register', {
            method: 'POST',
            body: {
                name: 'สมชาย ใจดี',
                email: 'somchai@example.com',
                phone: '0812345678',
                password: 'password123',
                confirmPassword: 'password123',
                acceptTerms: true
            }
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.user.email, 'somchai@example.com');
        assert.ok(client.cookies.has('connect.sid'));

        const userRow = await srv.db.get(
            'SELECT email, password_hash FROM users WHERE email = ?',
            ['somchai@example.com']
        );
        assert.ok(userRow);
        assert.notEqual(userRow.password_hash, 'password123');
        assert.equal(await bcrypt.compare('password123', userRow.password_hash), true);

        const dupRes = await client.request('/api/auth/register', {
            method: 'POST',
            body: {
                name: 'Duplicate',
                email: 'somchai@example.com',
                password: 'password123',
                confirmPassword: 'password123',
                acceptTerms: true
            }
        });
        assert.equal(dupRes.status, 409);
    });

    await t.test('persists login session across server restart and supports logout/login', async () => {
        // Restart server pointing at the same SQLite DB
        await srv.stop();
        srv = await startTestServer(dbPath);
        client.baseUrl = srv.baseUrl;

        const meAfterRestart = await client.request('/api/auth/me');
        assert.equal(meAfterRestart.status, 200);
        assert.equal(meAfterRestart.body.user.email, 'somchai@example.com');

        const logoutRes = await client.request('/api/auth/logout', { method: 'POST' });
        assert.equal(logoutRes.status, 200);

        const meAfterLogout = await client.request('/api/auth/me');
        assert.equal(meAfterLogout.body.user, null);

        const badLogin = await client.request('/api/auth/login', {
            method: 'POST',
            body: { email: 'somchai@example.com', password: 'wrong' }
        });
        assert.equal(badLogin.status, 401);

        const goodLogin = await client.request('/api/auth/login', {
            method: 'POST',
            body: { email: 'somchai@example.com', password: 'password123', remember: true }
        });
        assert.equal(goodLogin.status, 200);
        assert.equal(goodLogin.body.user.name, 'สมชาย ใจดี');
    });

    await t.test('stores cart in session and persists checkout order to SQLite', async () => {
        const add1 = await client.request('/api/cart/add', {
            method: 'POST',
            body: { productId: 1, quantity: 2 }
        });
        assert.equal(add1.status, 200);
        assert.equal(add1.body.totalCount, 2);
        assert.equal(add1.body.totalPrice, 360);

        const add2 = await client.request('/api/cart/add', {
            method: 'POST',
            body: { productId: 4, quantity: 1 }
        });
        assert.equal(add2.status, 200);
        assert.equal(add2.body.totalCount, 3);
        assert.equal(add2.body.totalPrice, 580);

        const remove1 = await client.request('/api/cart/1', { method: 'DELETE' });
        assert.equal(remove1.status, 200);
        assert.equal(remove1.body.totalCount, 1);
        assert.equal(remove1.body.totalPrice, 220);

        const checkoutRes = await client.request('/api/cart/checkout', { method: 'POST' });
        assert.equal(checkoutRes.status, 201);
        assert.equal(checkoutRes.body.totalPrice, 220);
        assert.equal(checkoutRes.body.cart.totalCount, 0);

        const orderRow = await srv.db.get('SELECT * FROM orders WHERE id = ?', [checkoutRes.body.orderId]);
        assert.ok(orderRow);
        assert.equal(orderRow.total_price, 220);

        const orderItems = await srv.db.all('SELECT * FROM order_items WHERE order_id = ?', [orderRow.id]);
        assert.equal(orderItems.length, 1);
        assert.equal(orderItems[0].product_name, 'ต้มยำกุ้ง');
        assert.equal(orderItems[0].quantity, 1);
    });
});
