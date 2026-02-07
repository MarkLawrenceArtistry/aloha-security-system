// ================================================
// FILE: src/controllers/backupController.js
// ================================================
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { logAction } = require('../utils/auditLogger');

// 1. DEFINE PATHS ROBUSTLY
const VOLUME_ROOT = process.env.VOLUME_PATH || path.join(__dirname, '../../');
const DB_PATH = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'aloha_database.db') 
    : path.join(__dirname, '../../aloha_database.db');

// Uploads are now consistently in a subfolder
const UPLOAD_DIR = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'uploads')
    : path.join(__dirname, '../../public/uploads');

// 1. CREATE BACKUP (Download ZIP)
const createBackup = async (req, res) => {
    try {
        const date = new Date().toISOString().slice(0,10);
        const filename = `aloha_backup_${date}.zip`;

        res.attachment(filename);

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', function(err) {
            res.status(500).send({error: err.message});
        });

        // Pipe zip data to response
        archive.pipe(res);

        // A. Add Database File to root of ZIP
        if (fs.existsSync(DB_PATH)) {
            archive.file(DB_PATH, { name: 'aloha_database.db' });
        }

        // B. Add Uploads Directory to 'uploads/' folder in ZIP
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

// 2. RESTORE BACKUP (Upload ZIP)
const restoreBackup = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, data: "No backup file uploaded." });
        }

        const zipPath = req.file.path;
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        // iterate over entries to place them correctly
        zipEntries.forEach((entry) => {
            const entryName = entry.entryName; // e.g., "aloha_database.db" or "uploads/resume.pdf"

            // 1. Handle Database Restore
            if (entryName === 'aloha_database.db') {
                // Extract DB specifically to the DB_PATH location (The Volume Root)
                // AdmZip extracts to a folder, so we extract to the folder containing DB_PATH
                const targetDir = path.dirname(DB_PATH);
                zip.extractEntryTo(entry, targetDir, false, true); 
            }
            
            // 2. Handle Uploads Restore
            else if (entryName.startsWith('uploads/')) {
                // Remove "uploads/" from the start of the path to keep structure clean
                // We extract these into the UPLOAD_DIR
                const targetDir = UPLOAD_DIR;
                
                // We extract the full folder structure inside uploads
                // AdmZip 'extractAllTo' is easier for folders, but let's be precise:
                // If we extract "uploads/file.jpg" to UPLOAD_DIR, we might get UPLOAD_DIR/uploads/file.jpg
                // We want UPLOAD_DIR/file.jpg
            }
        });

        // SIMPLER RESTORE STRATEGY:
        // 1. Extract DB to Volume Root
        zip.extractEntryTo("aloha_database.db", path.dirname(DB_PATH), false, true);
        
        // 2. Extract 'uploads' folder content. 
        // We extract the 'uploads' folder from zip into the parent of UPLOAD_DIR
        // If local: parent of public/uploads is 'public'.
        // If prod: parent of /app/railway_data/uploads is '/app/railway_data'.
        const uploadsParent = path.dirname(UPLOAD_DIR);
        zip.extractEntryTo("uploads/", uploadsParent, true, true);

        // Cleanup the uploaded temp zip
        fs.unlinkSync(zipPath);

        await logAction(req, 'SYSTEM_RESTORE', `Admin restored system from backup file.`);

        res.status(200).json({ success: true, data: "System restored successfully. Please refresh." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: "Restore failed: " + err.message });
    }
};

module.exports = { createBackup, restoreBackup };