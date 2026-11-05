const rateLimit = require('express-rate-limit')

const shared = { standardHeaders: true, legacyHeaders: false }
const globalLimiter = rateLimit({ ...shared, windowMs: 5 * 60 * 1000, limit: 300, message: { error: 'Too many requests. Try again later.' } })
const authLimiter = rateLimit({ ...shared, windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many attempts. Try again later.' } })

module.exports = { globalLimiter, authLimiter }
