const express = require('express');
const bcrypt = require('bcrypt');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s]{9,15}$/;
const REMEMBER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function toSafeUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || ''
    };
}

function establishSession(req, user, remember) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((regenErr) => {
            if (regenErr) return reject(regenErr);
            req.session.user = user;
            req.session.cart = [];
            if (remember) {
                req.session.cookie.maxAge = REMEMBER_MAX_AGE_MS;
            } else {
                req.session.cookie.expires = false;
            }
            req.session.save((saveErr) => {
                if (saveErr) return reject(saveErr);
                resolve();
            });
        });
    });
}

function createAuthRouter(db) {
    const router = express.Router();

    router.get('/me', (req, res) => {
        res.json({ user: req.session?.user || null });
    });

    router.post('/register', async (req, res, next) => {
        try {
            const name = String(req.body.name || '').trim();
            const email = String(req.body.email || '').trim().toLowerCase();
            const phone = String(req.body.phone || '').trim();
            const password = String(req.body.password || '');
            const confirmPassword = String(req.body.confirmPassword || '');
            const acceptTerms = Boolean(req.body.acceptTerms);

            if (!name || !email || !password || !confirmPassword) {
                return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน' });
            }
            if (!EMAIL_REGEX.test(email)) {
                return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
            }
            if (phone && !PHONE_REGEX.test(phone)) {
                return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)' });
            }
            if (password.length < 6) {
                return res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
            }
            if (password !== confirmPassword) {
                return res.status(400).json({ error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน' });
            }
            if (!acceptTerms) {
                return res.status(400).json({ error: 'กรุณายอมรับข้อกำหนดและเงื่อนไขการใช้งาน' });
            }

            const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
            if (existing) {
                return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const createdAt = new Date().toISOString();
            const result = await db.run(
                'INSERT INTO users (name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
                [name, email, phone, passwordHash, createdAt]
            );

            const safeUser = toSafeUser({ id: result.lastID, name, email, phone });
            await establishSession(req, safeUser, true);

            return res.status(201).json({
                message: `สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${safeUser.name}`,
                user: safeUser
            });
        } catch (err) {
            return next(err);
        }
    });

    router.post('/login', async (req, res, next) => {
        try {
            const email = String(req.body.email || '').trim().toLowerCase();
            const password = String(req.body.password || '');
            const remember = req.body.remember !== false;

            if (!email || !password) {
                return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน' });
            }

            const userRow = await db.get(
                'SELECT id, name, email, phone, password_hash FROM users WHERE LOWER(email) = ?',
                [email]
            );

            if (!userRow) {
                return res.status(401).json({
                    error: 'ไม่พบบัญชีอีเมลนี้ในระบบ กรุณาสมัครสมาชิกใหม่ก่อนเข้าสู่ระบบ'
                });
            }

            const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
            if (!passwordMatches) {
                return res.status(401).json({
                    error: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
                });
            }

            const safeUser = toSafeUser(userRow);
            await establishSession(req, safeUser, remember);

            return res.json({
                message: `เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ ${safeUser.name}`,
                user: safeUser
            });
        } catch (err) {
            return next(err);
        }
    });

    router.post('/logout', (req, res, next) => {
        if (!req.session) {
            res.clearCookie('connect.sid');
            return res.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' });
        }

        return req.session.destroy((err) => {
            if (err) return next(err);
            res.clearCookie('connect.sid');
            return res.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' });
        });
    });

    return router;
}

module.exports = { createAuthRouter };
