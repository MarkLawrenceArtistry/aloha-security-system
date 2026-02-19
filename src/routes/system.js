// ================================================
// FILE: src/routes/system.js
// ================================================
const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const settingsController = require('../controllers/settingsController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// IMPORT THE NEW MIDDLEWARE
const backupUpload = require('../middleware/backupUpload'); 

// Only Admins can Backup/Restore
router.get('/backup', verifyToken, verifyAdmin, backupController.createBackup);

// USE 'backupUpload' HERE INSTEAD OF 'upload'
router.post('/restore', verifyToken, verifyAdmin, backupUpload.single('backup_file'), backupController.restoreBackup);


router.get('/email-settings', verifyToken, verifyAdmin, settingsController.getEmailSettings);
router.post('/email-settings', verifyToken, verifyAdmin, settingsController.updateEmailSettings);

module.exports = router;