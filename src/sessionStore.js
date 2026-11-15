const session = require('express-session');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * express-session store backed by the SQLite `sessions` table.
 */
class SQLiteSessionStore extends session.Store {
    constructor(db, options = {}) {
        super();
        this.db = db;
        this.cleanupIntervalMs = options.cleanupIntervalMs ?? 15 * 60 * 1000;
        if (this.cleanupIntervalMs > 0) {
            this.cleanupTimer = setInterval(() => {
                this.pruneExpired().catch(() => {});
            }, this.cleanupIntervalMs);
            if (typeof this.cleanupTimer.unref === 'function') {
                this.cleanupTimer.unref();
            }
        }
    }

    static getExpirationTimestamp(sess) {
        const cookieExpires = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : null;
        if (cookieExpires && !Number.isNaN(cookieExpires)) {
            return cookieExpires;
        }
        const maxAge = typeof sess?.cookie?.maxAge === 'number' ? sess.cookie.maxAge : ONE_DAY_MS;
        return Date.now() + maxAge;
    }

    async pruneExpired() {
        await this.db.run('DELETE FROM sessions WHERE expired < ?', [Date.now()]);
    }

    get(sid, callback) {
        this.db
            .get('SELECT sess, expired FROM sessions WHERE sid = ?', [sid])
            .then((row) => {
                if (!row) {
                    return callback(null, null);
                }
                if (row.expired < Date.now()) {
                    return this.destroy(sid, () => callback(null, null));
                }
                try {
                    const parsed = JSON.parse(row.sess);
                    return callback(null, parsed);
                } catch (err) {
                    return callback(err);
                }
            })
            .catch((err) => callback(err));
    }

    set(sid, sess, callback) {
        const expired = SQLiteSessionStore.getExpirationTimestamp(sess);
        let serialized;
        try {
            serialized = JSON.stringify(sess);
        } catch (err) {
            return callback?.(err);
        }

        this.db
            .run(
                `INSERT INTO sessions (sid, sess, expired)
                 VALUES (?, ?, ?)
                 ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired`,
                [sid, serialized, expired]
            )
            .then(() => callback?.(null))
            .catch((err) => callback?.(err));
    }

    destroy(sid, callback) {
        this.db
            .run('DELETE FROM sessions WHERE sid = ?', [sid])
            .then(() => callback?.(null))
            .catch((err) => callback?.(err));
    }

    touch(sid, sess, callback) {
        const expired = SQLiteSessionStore.getExpirationTimestamp(sess);
        this.db
            .run('UPDATE sessions SET expired = ? WHERE sid = ?', [expired, sid])
            .then(() => callback?.(null))
            .catch((err) => callback?.(err));
    }

    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}

module.exports = { SQLiteSessionStore };
