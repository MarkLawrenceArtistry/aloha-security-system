// ================================================
// FILE: src/routes/audit.js
// ================================================
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyToken } = require('../middleware/authMiddleware');

// GET /api/audit/logs - Protected route to fetch all logs
router.get('/logs', verifyToken, auditController.getLogs);

module.exports = router;