// ================================================
// FILE: src/utils/auditLogger.js
// ================================================
const { run } = require('./helper');

/**
 * Records an administrative action in the audit_logs table.
 * @param {object} req - The Express request object (to get user and IP).
 * @param {string} action - A short code for the action (e.g., 'STATUS_UPDATE').
 * @param {string} details - A descriptive string of what happened.
 */
const logAction = async (req, action, details) => {
    try {
        // The user object is attached to the request by our verifyToken middleware
        const userId = req.user ? req.user.id : null; 
        const ipAddress = req.ip || req.connection.remoteAddress;

        await run(
            'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [userId, action, details, ipAddress]
        );
    } catch (err) {
        // We log the error but don't want to fail the user's main request
        // just because the audit log failed.
        console.error('CRITICAL: Failed to write to audit log:', err);
    }
};

module.exports = { logAction };