// ================================================
// FILE: src/utils/crypto.js
// ================================================
const crypto = require('crypto');

// Use a fixed key from .env or fallback (For production, ALWAYS use .env)
// The key must be exactly 32 chars (256 bits)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; 
const IV_LENGTH = 16; // AES block size

// Encrypt text (Returns: iv:encryptedData)
const encrypt = (text) => {
    if (!text) return text;
    try {
        // Create a random Initialization Vector
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(String(text));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        // Return IV + Encrypted Data as hex
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error("Encryption error:", e);
        return text; // Fail safe: return original if error (or handle differently)
    }
};

// Decrypt text
const decrypt = (text) => {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        // If not formatted as iv:content, assume it's old plaintext data
        if (textParts.length !== 2) return text; 

        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // If decryption fails, it might be old plaintext data
        return text;
    }
};

// Hash for searching (Deterministic: Same Input = Same Output)
const hashData = (text) => {
    if (!text) return null;
    return crypto.createHash('sha256').update(String(text)).digest('hex');
};

module.exports = { encrypt, decrypt, hashData };