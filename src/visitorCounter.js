const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

const bangkokPartsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

function getBangkokParts(date = new Date()) {
    const parts = bangkokPartsFormatter.formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    }
    const hour = map.hour === '24' ? '00' : map.hour;
    return {
        year: map.year,
        month: map.month,
        day: map.day,
        hour,
        minute: map.minute,
        second: map.second
    };
}

/**
 * Return YYYY-MM-DD date string in Asia/Bangkok timezone.
 */
function getBangkokDate(date = new Date()) {
    const { year, month, day } = getBangkokParts(date);
    return `${year}-${month}-${day}`;
}

/**
 * Return ISO-8601 timestamp string with +07:00 offset in Asia/Bangkok timezone.
 */
function getBangkokTimestamp(date = new Date()) {
    const { year, month, day, hour, minute, second } = getBangkokParts(date);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
}

function normalizeIp(ip) {
    if (typeof ip !== 'string') return 'unknown';
    const trimmed = ip.trim();
    if (!trimmed) return 'unknown';
    return trimmed.replace(/^::ffff:/i, '');
}

function extractClientIp(req) {
    return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

async function getVisitorStats(db, now = new Date()) {
    const visitDate = getBangkokDate(now);
    const todayRow = await db.get(
        'SELECT COUNT(*) AS count FROM home_visitors WHERE visit_date = ?',
        [visitDate]
    );
    const totalRow = await db.get(
        'SELECT COUNT(*) AS count FROM home_visitors'
    );

    return {
        visitDate,
        todayCount: todayRow ? todayRow.count : 0,
        totalCount: totalRow ? totalRow.count : 0
    };
}

/**
 * Record a Home page visit for an IP address in Asia/Bangkok timezone.
 * Same IP on the same Bangkok date updates last_visited_at without increasing the counter.
 */
async function recordHomeVisit(db, ipAddress, now = new Date()) {
    const normalizedIp = normalizeIp(ipAddress);
    const visitDate = getBangkokDate(now);
    const timestamp = getBangkokTimestamp(now);

    await db.run(
        `INSERT INTO home_visitors (ip_address, visit_date, first_visited_at, last_visited_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(ip_address, visit_date) DO UPDATE SET
             last_visited_at = excluded.last_visited_at`,
        [normalizedIp, visitDate, timestamp, timestamp]
    );

    const stats = await getVisitorStats(db, now);
    return {
        ipAddress: normalizedIp,
        ...stats
    };
}

module.exports = {
    BANGKOK_TIME_ZONE,
    getBangkokDate,
    getBangkokTimestamp,
    normalizeIp,
    extractClientIp,
    getVisitorStats,
    recordHomeVisit
};
