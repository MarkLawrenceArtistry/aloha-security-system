// ================================================
// FILE: src/middleware/rateLimiter.js
// ================================================
const rateLimit = require('express-rate-limit');

// 1. Strict Limiter for Application Form (Unchanged)
const applicationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 5, 
    message: {
        success: false,
        data: "Too many applications from this IP, please try again after an hour."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. Login Limiter (FIXED: 2 attempts / 30 seconds)
const loginLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 Seconds window
    max: 2, // Max 2 attempts
    message: {
        success: false,
        data: "Too many failed login attempts. Please wait 30 seconds before trying again."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1, // Only 1 request allowed per minute
    message: {
        success: false,
        data: "Please wait 1 minute before requesting another OTP code."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Update exports
module.exports = { applicationLimiter, loginLimiter, otpLimiter };