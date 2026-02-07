// ================================================
// FILE: src/middleware/backupUpload.js
// ================================================
const multer = require('multer');
const path = require('path');

// Use the same destination logic
const BASE_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../../public');
const UPLOAD_PATH = path.join(BASE_PATH, 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
        // Name it temporarily
        cb(null, 'temp_restore_' + Date.now() + '.zip');
    }
});

const backupUpload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // Limit to 100MB for backups
    fileFilter: (req, file, cb) => {
        // Check extension
        const ext = path.extname(file.originalname).toLowerCase();
        // Check mime type (sometimes zips have different mimes, extension check is safer for this)
        if (ext === '.zip') {
            return cb(null, true);
        }
        cb(new Error('Error: Only .zip files are allowed for System Restore!'));
    }
});

module.exports = backupUpload;