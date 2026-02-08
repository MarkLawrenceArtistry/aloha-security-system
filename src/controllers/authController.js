// ================================================
// FILE: src/controllers/authController.js
// ================================================
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { get, run } = require('../utils/helper');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { logAction } = require('../utils/auditLogger');

// Login (Updated to include role in response)
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await get("SELECT * FROM users WHERE email = ?", [email]);

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, data: "Invalid credentials." });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({
            success: true,
            data: {
                token: token,
                user: { id: user.id, username: user.username, role: user.role } // Return Role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// 1. Forgot Password - Step 1: Get Question
const getSecurityQuestion = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await get("SELECT security_question FROM users WHERE email = ?", [email]);

        // FIXED: Generic error message to prevent account harvesting/enumeration.
        // Whether the user doesn't exist OR simply hasn't set a question, we return the same vague error.
        if (!user || !user.security_question) {
            // We use a generic 400 status and message so hackers can't distinguish between "User Missing" vs "Config Missing"
            return res.status(400).json({ 
                success: false, 
                data: "Unable to retrieve security details. Please contact support if this persists." 
            });
        }

        res.status(200).json({ success: true, data: { question: user.security_question } });
    } catch (err) {
        // Even server errors should be generic in production, but for now we keep the log
        console.error(err);
        res.status(500).json({ success: false, data: "An unexpected error occurred." });
    }
};

// 2. Forgot Password - Step 2: Verify & Reset
const resetPassword = async (req, res) => {
    try {
        const { email, answer, newPassword } = req.body;
        const user = await get("SELECT id, security_answer_hash FROM users WHERE email = ?", [email]);

        if (!user) return res.status(404).json({ success: false, data: "User not found." });

        const isMatch = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer_hash);
        if (!isMatch) return res.status(401).json({ success: false, data: "Incorrect security answer." });

        const newHash = await bcrypt.hash(newPassword, 10);
        await run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);

        await logAction({ user: { id: user.id }, ip: req.ip }, 'PASS_RESET', `Password reset via security question for ${email}`);

        res.status(200).json({ success: true, data: "Password reset successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// 3. Settings - Update Profile (Password / Security Q)
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword, newQuestion, newAnswer } = req.body;

        const user = await get("SELECT password_hash FROM users WHERE id = ?", [userId]);

        // Verify current password first
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) return res.status(401).json({ success: false, data: "Current password incorrect." });

        // Update Password if provided
        if (newPassword) {
            const hash = await bcrypt.hash(newPassword, 10);
            await run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
        }

        // Update Security Question if provided
        if (newQuestion && newAnswer) {
            const ansHash = await bcrypt.hash(newAnswer.toLowerCase().trim(), 10);
            await run("UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?", 
                [newQuestion, ansHash, userId]);
        }

        await logAction(req, 'PROFILE_UPDATE', `User ID ${userId} updated their security settings.`);
        res.status(200).json({ success: true, data: "Settings updated successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

module.exports = { login, getSecurityQuestion, resetPassword, updateProfile };