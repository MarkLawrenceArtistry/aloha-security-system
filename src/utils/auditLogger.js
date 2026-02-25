// ================================================
// FILE: src/utils/auditLogger.js
// ================================================
const { run } = require('./helper');

const logAction = async (req, action, details) => {
    try {
        const userId = req.user ? req.user.id : null; 
        const ipAddress = req.ip || req.connection.remoteAddress;

        // --- TIMEZONE FIX: Force Philippine Time (UTC+8) ---
        // 1. Get current UTC time
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        
        // 2. Add 8 Hours for Philippines
        const phOffset = 8; 
        const phTime = new Date(utc + (3600000 * phOffset));

        // 3. Format to SQL String: YYYY-MM-DD HH:MM:SS
        const year = phTime.getFullYear();
        const month = String(phTime.getMonth() + 1).padStart(2, '0');
        const day = String(phTime.getDate()).padStart(2, '0');
        const hours = String(phTime.getHours()).padStart(2, '0');
        const minutes = String(phTime.getMinutes()).padStart(2, '0');
        const seconds = String(phTime.getSeconds()).padStart(2, '0');
        
        const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        // 4. Insert explicitly with the calculated timestamp
        await run(
            'INSERT INTO audit_logs (user_id, action, details, ip_address, timestamp) VALUES (?, ?, ?, ?, ?)',
            [userId, action, details, ipAddress, timestamp]
        );
    } catch (err) {
        // We log the error but don't want to fail the user's main request
        console.error('CRITICAL: Failed to write to audit log:', err);
    }
};

module.exports = { logAction };