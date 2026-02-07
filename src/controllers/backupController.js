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
        
        db.close((err) => {
            if (err) {
                console.error("WARNING: Failed to close database before restore. This may cause issues.", err);
            }
            console.log("Database connection closed for restore.");

            try {
                const zip = new AdmZip(zipPath);
                const zipEntries = zip.getEntries(); // Get a list of all files/folders in the zip
                
                const volumePath = process.env.VOLUME_PATH || path.join(__dirname, '../../');
                
                // 1. Restore the Database (should always exist)
                zip.extractEntryTo('aloha_database.db', volumePath, /*maintainEntryPath*/ false, /*overwrite*/ true);
                console.log("Database file restored.");

                // --- THE FIX IS HERE ---
                // 2. Check if an 'uploads' directory exists in the zip before trying to extract it.
                const uploadsEntryExists = zipEntries.some(entry => entry.entryName.startsWith('uploads/'));

                if (uploadsEntryExists) {
                    // This command extracts the entire 'uploads' directory and its contents
                    zip.extractEntryTo('uploads/', volumePath, /*maintainEntryPath*/ true, /*overwrite*/ true);
                    console.log("Uploads directory restored.");
                } else {
                    console.log("No 'uploads' directory found in backup zip. Skipping.");
                }
                // --- END OF FIX ---

                // 3. Clean up and restart
                fs.unlinkSync(zipPath);
                res.status(200).json({ success: true, data: "Restore successful! Server is restarting..." });
                
                setTimeout(() => {
                    console.log("Forcing server restart to apply restored database.");
                    process.exit(1);
                }, 1000);

            } catch (extractErr) {
                console.error("Error during ZIP extraction:", extractErr);
                if (!res.headersSent) {
                   res.status(500).json({ success: false, data: "Restore failed: " + extractErr.message });
                }
            }
        });

    } catch (err) {
        console.error("Outer restoreBackup error:", err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, data: "Restore failed: " + err.message });
        }
    }
};

module.exports = { createBackup, restoreBackup };