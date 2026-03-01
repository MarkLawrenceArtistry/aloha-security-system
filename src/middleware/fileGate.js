// ================================================
// FILE: src/middleware/fileGate.js
// ================================================
const fs = require('fs');
const crypto = require('crypto');

// 1. STRICT MAGIC NUMBER CHECK (File Extension Verification)
const checkMagicNumber = (filePath) => {
    try {
        const buffer = Buffer.alloc(8); // Read first 8 bytes
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        
        const hex = buffer.toString('hex').toLowerCase();
        
        // PDF (%PDF)
        if (hex.startsWith('25504446')) return true;
        // JPEG (FF D8 FF)
        if (hex.startsWith('ffd8ff')) return true;
        // PNG (89 50 4E 47 0D 0A 1A 0A)
        if (hex.startsWith('89504e470d0a1a0a')) return true;
        
        return false;
    } catch (err) {
        return false;
    }
};

// 2. MALICIOUS SCRIPT SCANNER (Basic Sanitization)
// Scans the first 8KB of the file for obvious script injections
const scanForScripts = (filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        // Convert buffer to string (latin1 preserves byte values better for scanning)
        const content = buffer.toString('latin1').toLowerCase();

        // Dangerous patterns often found in Polyglot files
        const maliciousPatterns = [
            '<script', 
            'javascript:', 
            'vbscript:', 
            'onload=', 
            'onerror=', 
            'eval(',
            'document.cookie',
            '<?php'
        ];

        for (const pattern of maliciousPatterns) {
            if (content.includes(pattern)) {
                console.warn(`SECURITY: Detected potential script injection: "${pattern}"`);
                return true; // Malicious content found
            }
        }
        return false; // Safe
    } catch (err) {
        return true; // Fail safe: assume malicious if we can't read
    }
};

const fileGate = (req, res, next) => {
    if (!req.files) return next();

    let isMalicious = false;
    let failReason = "";

    // Loop through all uploaded files
    for (const fieldname in req.files) {
        if (isMalicious) break;

        req.files[fieldname].forEach(file => {
            if (isMalicious) return;

            // CHECK 1: File Extension Verification (Magic Number)
            if (!checkMagicNumber(file.path)) {
                isMalicious = true;
                failReason = "Invalid file signature (Spoofed Extension)";
                return;
            }

            // CHECK 2: Malicious Code Scanning
            if (scanForScripts(file.path)) {
                isMalicious = true;
                failReason = "Embedded script/code detected in file";
                return;
            }

            // CHECK 3: Hash Generation (For Duplicate Detection later)
            const fileBuffer = fs.readFileSync(file.path);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            file.fileHash = hash; 
        });
    }

    if (isMalicious) {
        // Immediate Cleanup: Delete ALL files in this request
        for (const fieldname in req.files) {
            req.files[fieldname].forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }
        
        console.error(`SECURITY BLOCK: ${failReason} from IP ${req.ip}`);
        return res.status(400).json({ 
            success: false, 
            data: `Security Alert: Upload rejected. ${failReason}.` 
        });
    }

    next();
};

module.exports = fileGate;