// ================================================
// FILE: src/controllers/auditController.js
// ================================================
const { all, get } = require('../utils/helper');

const getLogs = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', filter = '', sort = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const searchTerm = `%${search}%`; 

        let query = `
            SELECT al.id, al.action, al.details, al.ip_address, al.timestamp, u.username as admin_username
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE (al.details LIKE ? OR u.username LIKE ?)
        `;
        let params = [searchTerm, searchTerm];
        let countParams = [searchTerm, searchTerm];

        if (filter) {
            query += ` AND al.action LIKE ?`;
            params.push(`%${filter}%`);
            countParams.push(`%${filter}%`);
        }

        query += ` ORDER BY al.timestamp ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const logs = await all(query, params);
        
        let countQuery = `SELECT COUNT(*) as count FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE (al.details LIKE ? OR u.username LIKE ?)`;
        if (filter) countQuery += ` AND al.action LIKE ?`;
        
        const countResult = await get(countQuery, countParams);
        const total_records = countResult.count;

        res.status(200).json({
            success: true, data: logs,
            pagination: { current_page: parseInt(page), total_pages: Math.ceil(total_records / limit), total_records }
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

module.exports = { getLogs };