const test = require('node:test');
const assert = require('node:assert/strict');

const { createDatabase } = require('../src/db');
const {
    getBangkokDate,
    getBangkokTimestamp,
    normalizeIp,
    recordHomeVisit,
    getVisitorStats
} = require('../src/visitorCounter');

test('Asia/Bangkok timezone helpers format date and timestamp across UTC midnight boundary', () => {
    const beforeBangkokMidnight = new Date('2026-11-17T16:59:59.000Z');
    const atBangkokMidnight = new Date('2026-11-17T17:00:00.000Z');

    assert.equal(getBangkokDate(beforeBangkokMidnight), '2026-11-17');
    assert.equal(getBangkokTimestamp(beforeBangkokMidnight), '2026-11-17T23:59:59+07:00');

    assert.equal(getBangkokDate(atBangkokMidnight), '2026-11-18');
    assert.equal(getBangkokTimestamp(atBangkokMidnight), '2026-11-18T00:00:00+07:00');
});

test('normalizeIp strips IPv4-mapped IPv6 prefix', () => {
    assert.equal(normalizeIp('::ffff:192.168.1.10'), '192.168.1.10');
    assert.equal(normalizeIp(' 203.0.113.5 '), '203.0.113.5');
    assert.equal(normalizeIp(''), 'unknown');
});

test('home_visitors enforces composite PRIMARY KEY (ip_address, visit_date)', async () => {
    const db = createDatabase(':memory:');
    await db.init();

    try {
        const columns = await db.all('PRAGMA table_info(home_visitors)');
        const pkCols = columns
            .filter((col) => col.pk > 0)
            .sort((a, b) => a.pk - b.pk)
            .map((col) => col.name);

        assert.deepEqual(pkCols, ['ip_address', 'visit_date']);

        await db.run(
            `INSERT INTO home_visitors (ip_address, visit_date, first_visited_at, last_visited_at)
             VALUES (?, ?, ?, ?)`,
            ['203.0.113.1', '2026-11-17', '2026-11-17T10:00:00+07:00', '2026-11-17T10:00:00+07:00']
        );

        await assert.rejects(
            db.run(
                `INSERT INTO home_visitors (ip_address, visit_date, first_visited_at, last_visited_at)
                 VALUES (?, ?, ?, ?)`,
                ['203.0.113.1', '2026-11-17', '2026-11-17T11:00:00+07:00', '2026-11-17T11:00:00+07:00']
            ),
            /UNIQUE constraint failed|SQLITE_CONSTRAINT/
        );
    } finally {
        await db.close();
    }
});

test('recordHomeVisit counts unique IP once per Bangkok day, updates last_visited_at, and resets on new day', async () => {
    const db = createDatabase(':memory:');
    await db.init();

    try {
        const morning = new Date('2026-11-17T02:00:00.000Z'); // 09:00:00+07:00
        const evening = new Date('2026-11-17T16:30:00.000Z'); // 23:30:00+07:00
        const nextDay = new Date('2026-11-17T17:05:00.000Z'); // 2026-11-18 00:05:00+07:00

        // First visit from IP 1 on 2026-11-17
        const first = await recordHomeVisit(db, '203.0.113.10', morning);
        assert.equal(first.visitDate, '2026-11-17');
        assert.equal(first.todayCount, 1);
        assert.equal(first.totalCount, 1);

        // Repeat visit from same IP (with ::ffff: prefix) later the same Bangkok day
        const repeat = await recordHomeVisit(db, '::ffff:203.0.113.10', evening);
        assert.equal(repeat.todayCount, 1);
        assert.equal(repeat.totalCount, 1);

        const rowDay1 = await db.get(
            'SELECT * FROM home_visitors WHERE ip_address = ? AND visit_date = ?',
            ['203.0.113.10', '2026-11-17']
        );
        assert.equal(rowDay1.first_visited_at, '2026-11-17T09:00:00+07:00');
        assert.equal(rowDay1.last_visited_at, '2026-11-17T23:30:00+07:00');

        // Second unique IP on the same Bangkok day
        const secondIp = await recordHomeVisit(db, '198.51.100.25', evening);
        assert.equal(secondIp.todayCount, 2);
        assert.equal(secondIp.totalCount, 2);

        // Same IP 1 visits again after Bangkok midnight -> counted as new visit on new day
        const newDayVisit = await recordHomeVisit(db, '203.0.113.10', nextDay);
        assert.equal(newDayVisit.visitDate, '2026-11-18');
        assert.equal(newDayVisit.todayCount, 1);
        assert.equal(newDayVisit.totalCount, 3);

        const statsNextDay = await getVisitorStats(db, nextDay);
        assert.equal(statsNextDay.todayCount, 1);
        assert.equal(statsNextDay.totalCount, 3);
    } finally {
        await db.close();
    }
});
