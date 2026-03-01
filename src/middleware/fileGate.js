// ================================================
// FILE: src/middleware/fileGate.js
// ================================================
const fs = require('fs');
const crypto = require('crypto');

// Magic numbers (Hexadecimal signatures) for genuine files
const checkMagicNumber = (filePath) => {
    try {
        const buffer = Buffer.alloc(4);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        
        const hex = buffer.toString('hex').toLowerCase();
        
        // 25504446 = PDF
        // ffd8ff = JPEG/JPG
        // 89504e47 = PNG
        return hex.startsWith('25504446') || hex.startsWith('ffd8ff') || hex.startsWith('89504e47');
    } catch (err) {
        return false;
    }
};

const fileGate = (req, res, next) => {
    if (!req.files) return next();

    let isMalicious = false;

    // Loop through all uploaded files
    for (const fieldname in req.files) {
        req.files[fieldname].forEach(file => {
            // 1. Security Check: Is it truly an image or PDF?
            if (!checkMagicNumber(file.path)) {
                isMalicious = true;
            } else {
                // 2. Hash Generation: Create a unique SHA-256 fingerprint of the file
                const fileBuffer = fs.readFileSync(file.path);
                const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                file.fileHash = hash; // Attach the hash to the file object for the controller to use
            }
        });
    }

    if (isMalicious) {
        // If ANY file is malicious, delete ALL files uploaded in this request to protect the server
        for (const fieldname in req.files) {
            req.files[fieldname].forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }
        return res.status(400).json({ 
            success: false, 
            data: "SECURITY ALERT: Malicious or spoofed file signature detected. Upload rejected." 
        });
    }

    next();
};

module.exports = fileGate;