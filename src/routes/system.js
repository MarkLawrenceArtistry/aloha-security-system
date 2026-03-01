// ================================================
// FILE: src/routes/system.js
// ================================================
const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const settingsController = require('../controllers/settingsController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const reportController = require('../controllers/reportController');

// IMPORT THE NEW MIDDLEWARE
const backupUpload = require('../middleware/backupUpload'); 

// Only Admins can Backup/Restore
router.get('/backup', verifyToken, verifyAdmin, backupController.createBackup);

// USE 'backupUpload' HERE INSTEAD OF 'upload'
router.post('/restore', verifyToken, verifyAdmin, backupUpload.single('backup_file'), backupController.restoreBackup);


router.get('/email-settings', verifyToken, verifyAdmin, settingsController.getEmailSettings);
router.post('/email-settings', verifyToken, verifyAdmin, settingsController.updateEmailSettings);


router.post('/trigger-cron', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const database = require('../database').getDB();
        const fs = require('fs');
        const path = require('path');
        const UPLOAD_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../../public/uploads');

        // 1. Delete Rejected Apps
        const retentionPeriod = 72 * 60 * 60 * 1000; 
        const cutoffDate = new Date(Date.now() - retentionPeriod).toISOString();
        
        database.all("SELECT id, resume_path, id_image_path FROM applicants WHERE status = 'Rejected' AND updated_at < ?", [cutoffDate], (err, rows) => {
            if (rows) {
                rows.forEach(applicant => {
                    const deleteFile = (urlPath) => {
                        if (!urlPath) return;
                        const filename = urlPath.split('/').pop();
                        const filePath = path.join(UPLOAD_PATH, filename);
                        fs.unlink(filePath, (e) => {});
                    };
                    deleteFile(applicant.resume_path);
                    deleteFile(applicant.id_image_path);
                    database.run("DELETE FROM applicants WHERE id = ?", [applicant.id]);
                });
            }
        });

        // 2. Delete old Audit Logs
        database.run("DELETE FROM audit_logs WHERE timestamp <= date('now', '-1 year')");

        // 3. Log this action
        const { logAction } = require('../utils/auditLogger');
        await logAction(req, 'MANUAL_CRON', `Admin manually triggered system maintenance tasks.`);

        res.status(200).json({ success: true, data: "Maintenance tasks executed successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
});

router.get('/force-migration', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { getDB } = require('../database');
        const db = getDB();
        
        db.run(`ALTER TABLE applicants ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    return res.status(200).json({ success: true, data: "Column already exists. No action needed." });
                }
                return res.status(500).json({ success: false, data: "Migration failed: " + err.message });
            }
            res.status(200).json({ success: true, data: "Successfully added 'updated_at' column!" });
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
});

router.get('/nuke-db', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        // Close DB first
        const { closeDB } = require('../database');
        await closeDB();

        const DB_PATH = process.env.VOLUME_PATH 
            ? path.join(process.env.VOLUME_PATH, 'aloha_database.db') 
            : path.join(__dirname, '../../aloha_database.db');

        if (fs.existsSync(DB_PATH)) {
            fs.unlinkSync(DB_PATH); // Delete the file
            
            // Re-initialize (Create fresh DB)
            const { connectDB, initDB } = require('../database');
            connectDB();
            initDB();
            
            return res.status(200).json({ success: true, data: "Database deleted and recreated. All data has been wiped and schema is now fresh." });
        } else {
            return res.status(200).json({ success: true, data: "Database file didn't exist, created a new one." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: err.message });
    }
});

router.get('/master-report', verifyToken, verifyAdmin, reportController.generateMasterReport);

router.get('/config', verifyToken, settingsController.getSystemSettings);
router.post('/config', verifyToken, verifyAdmin, settingsController.updateSystemSettings);
router.get('/public-config', settingsController.getPublicSettings);

router.get('/encrypt-migration', verifyToken, verifyAdmin, async (req, res) => {
    try {
        // Import directly inside the route to guarantee they are found
        const { encrypt, hashData } = require('../utils/crypto');
        const { getDB } = require('../database');
        const db = getDB();
        
        // 1. Fetch all applicants
        db.all("SELECT * FROM applicants", [], (err, rows) => {
            if (err) return res.status(500).json({success:false, data: err.message});
            
            let count = 0;
            
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                
                rows.forEach(row => {
                    // Check if already encrypted (contains ':' from the IV)
                    if (row.email && !row.email.includes(':')) {
                        const emailHash = hashData(row.email);
                        const encEmail = encrypt(row.email);
                        const encPhone = encrypt(row.contact_num);
                        const encAddr = encrypt(row.address);
                        const encBday = encrypt(row.birthdate);
                        const encPrev = encrypt(row.previous_employer);

                        db.run(`UPDATE applicants SET 
                            email = ?, contact_num = ?, address = ?, 
                            birthdate = ?, previous_employer = ?, email_hash = ? 
                            WHERE id = ?`, 
                            [encEmail, encPhone, encAddr, encBday, encPrev, emailHash, row.id]
                        );
                        count++;
                    }
                });

                db.run("COMMIT");
            });

            res.json({ success: true, data: `Migration complete. Encrypted ${count} records.` });
        });
    } catch (error) {
        res.status(500).json({ success: false, data: `Internal Server Error: ${error.message}` });
    }
});

module.exports = router;