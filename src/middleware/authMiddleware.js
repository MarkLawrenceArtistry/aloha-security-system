const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; // In production, put this in .env

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    // Check if header exists "Bearer <token>"
    if (!authHeader) {
        return res.status(403).json({ success: false, data: "No token provided. Access Denied." });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ success: false, data: "Malformed token." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, data: "Invalid or expired token." });
    }
};

const verifyAdmin = (req, res, next) => {
    // verifyToken must run before this to populate req.user
    if (req.user && (req.user.role === 'Admin' || req.user.role === 'Owner')) {
        next();
    } else {
        return res.status(403).json({ success: false, data: "Access Denied: Admin privileges required." });
    }
};

module.exports = { verifyToken, verifyAdmin, JWT_SECRET };