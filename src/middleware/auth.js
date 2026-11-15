function summarizeCart(rawItems) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    let totalCount = 0;
    let totalPrice = 0;

    for (const item of items) {
        totalCount += item.quantity;
        totalPrice += item.price * item.quantity;
    }

    return { items, totalCount, totalPrice };
}

function attachSessionLocals(req, res, next) {
    res.locals.currentUser = req.session?.user || null;
    res.locals.cart = summarizeCart(req.session?.cart);
    next();
}

function requireAuthApi(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ'
        });
    }
    return next();
}

module.exports = { summarizeCart, attachSessionLocals, requireAuthApi };
