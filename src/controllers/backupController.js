// ================================================
// FILE: src/controllers/backupController.js
// ================================================
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { logAction } = require('../utils/auditLogger');
// Import the new DB management functions
const { closeDB, connectDB, initDB } = require('../database');

const VOLUME_ROOT = process.env.VOLUME_PATH || path.join(__dirname, '../../');
const DB_PATH = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'aloha_database.db') 
    : path.join(__dirname, '../../aloha_database.db');

const UPLOAD_DIR = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'uploads')
    : path.join(__dirname, '../../public/uploads');

// 1. CREATE BACKUP
const createBackup = async (req, res) => {
    try {
        const date = new Date().toISOString().slice(0,10);
        const filename = `aloha_backup_${date}.zip`;

        res.attachment(filename);

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', function(err) {
            res.status(500).send({error: err.message});
        });

        archive.pipe(res);

        if (fs.existsSync(DB_PATH)) {
            archive.file(DB_PATH, { name: 'aloha_database.db' });
        }

        if (fs.existsSync(UPLOAD_DIR)) {
            archive.directory(UPLOAD_DIR, 'uploads');
        }

        await archive.finalize();
        await logAction(req, 'SYSTEM_BACKUP', `Admin downloaded a system backup.`);
        
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, data: "Backup failed." });
    }
};

// 2. RESTORE BACKUP (HOT RELOAD)
const restoreBackup = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, data: "No backup file uploaded." });
        }

        const zipPath = req.file.path;
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        let dbRestored = false;
        let uploadsRestored = 0;

        // --- STEP 1: CLOSE DATABASE CONNECTION ---
        // This releases the file lock on aloha_database.db so we can overwrite it
        await closeDB();

        // --- STEP 2: OVERWRITE FILES ---
        zipEntries.forEach((entry) => {
            const entryName = entry.entryName; 

            try {
                if (entryName.endsWith('aloha_database.db')) {
                    const targetDir = path.dirname(DB_PATH);
                    zip.extractEntryTo(entry, targetDir, false, true); 
                    dbRestored = true;
                }
                else if (entryName.startsWith('uploads/') && !entry.isDirectory) {
                    const uploadsParent = path.dirname(UPLOAD_DIR);
                    zip.extractEntryTo(entry, uploadsParent, true, true);
                    uploadsRestored++;
                }
            } catch (extractErr) {
                console.warn(`Skipping entry ${entryName}: ${extractErr.message}`);
            }
        });

        // Cleanup temp file
        try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch (e) {}

        // --- STEP 3: RECONNECT DATABASE ---
        // Open the new connection to the newly restored file
        connectDB();
        // Run initDB to ensure if the restored DB was old, it gets any new migration columns
        initDB();

        if (!dbRestored && uploadsRestored === 0) {
             return res.status(400).json({ success: false, data: "Invalid backup file. No database or uploads found." });
        }

        await logAction(req, 'SYSTEM_RESTORE', `Admin restored system from backup file.`);

        // --- STEP 4: SUCCESS RESPONSE (No process exit!) ---
        res.status(200).json({ 
            success: true, 
            data: "Restore successful! System has been hot-reloaded." 
        });

    } catch (err) {
        console.error(err);
        // Attempt to reconnect if something failed, so the server isn't dead
        connectDB();
        
        if (!res.headersSent) {
            res.status(500).json({ success: false, data: "Restore failed: " + err.message });
        }
    }
};

module.exports = { createBackup, restoreBackup };
// THis is an update