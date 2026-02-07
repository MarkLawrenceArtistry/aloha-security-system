// ================================================
// FILE: src/middleware/rateLimiter.js
// ================================================
const rateLimit = require('express-rate-limit');

// 1. Strict Limiter for Application Form
// Limit: 5 requests per 1 hour window per IP
const applicationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        success: false,
        data: "Too many applications from this IP, please try again after an hour."
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 2. Login Limiter (Brute Force Protection)
// Limit: 5 failed attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        data: "Too many login attempts. Please try again in 15 minutes."
    }
});

module.exports = { applicationLimiter, loginLimiter };