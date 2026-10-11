import rateLimit from 'express-rate-limit';

const message = (text) => (req, res) =>
    res.status(429).json({ success: false, code: 'rate_limited', message: text });

/** Making rooms writes a file, so it is the tightest. */
export const createRoomLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: message('That is a lot of new worlds. Give it a minute.'),
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: message('Slow down a little and try again.'),
});
