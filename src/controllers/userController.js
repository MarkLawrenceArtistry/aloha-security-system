// ================================================
// FILE: src/controllers/userController.js
// ================================================
const bcrypt = require('bcrypt');
const { run, all, get } = require('../utils/helper');
const { logAction } = require('../utils/auditLogger');

// GET /api/users
const getUsers = async (req, res) => {
    try {
        // Select everything EXCEPT the password hash for security
        const users = await all("SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC");
        res.status(200).json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// POST /api/users
const createUser = async (req, res) => {
    try {
        const { username, email, password, role, security_question, security_answer } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, data: "Missing required fields." });
        }

        if (role === 'Owner') {
            return res.status(403).json({ success: false, data: "Cannot create additional Owner accounts." });
        }

        // Check for duplicate
        const existing = await get("SELECT id FROM users WHERE email = ? OR username = ?", [email, username]);
        if (existing) {
            return res.status(409).json({ success: false, data: "Username or Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        let answerHash = null;
        if (security_answer) {
            answerHash = await bcrypt.hash(security_answer.toLowerCase().trim(), 10);
        }

        const userRole = role || 'Admin';

        await run(
            "INSERT INTO users (username, email, password_hash, role, security_question, security_answer_hash) VALUES (?, ?, ?, ?, ?, ?)",
            [username, email, hashedPassword, userRole, security_question, answerHash]
        );

        await logAction(req, 'USER_CREATE', `Created user: ${username} (${email})`);

        res.status(201).json({ success: true, data: "User created successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role, password } = req.body;
        const requestingUserId = req.user.id;
        const requestingUserRole = req.user.role;

        // check if user exists
        const user = await get("SELECT id, role FROM users WHERE id = ?", [id]);
        if (!user) return res.status(404).json({ success: false, data: "User not found." });

        // SECURITY 1: Admin cannot edit Owner at all. Only the Owner can edit the Owner.
        if (user.role === 'Owner' && requestingUserRole !== 'Owner') {
            return res.status(403).json({ success: false, data: "Access Denied: You do not have permission to edit the Owner account." });
        }

        // SECURITY 2: Admin cannot assign the Owner role to someone else
        if (user.role !== 'Owner' && role === 'Owner') {
            return res.status(403).json({ success: false, data: "Cannot assign Owner role to existing users." });
        }

        // SECURITY 3: Users cannot change their own role
        if (parseInt(id) === parseInt(requestingUserId) && role !== user.role) {
            return res.status(403).json({ success: false, data: "You cannot change your own role. Ask another Admin or the Owner." });
        }

        const finalRole = user.role === 'Owner' ? 'Owner' : role;

        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            await run(
                "UPDATE users SET username = ?, email = ?, role = ?, password_hash = ? WHERE id = ?",
                [username, email, finalRole, hashedPassword, id]
            );
        } else {
            await run(
                "UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?",
                [username, email, finalRole, id]
            );
        }

        await logAction(req, 'USER_UPDATE', `Updated user details for ID: ${id}`);
        res.status(200).json({ success: true, data: "User updated successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const requestingUserId = req.user.id; 

        if (parseInt(id) === parseInt(requestingUserId)) {
            return res.status(403).json({ success: false, data: "You cannot delete your own account." });
        }

        const userToDelete = await get("SELECT username, role FROM users WHERE id = ?", [id]);
        if (!userToDelete) return res.status(404).json({ success: false, data: "User not found." });

        if (userToDelete.role === 'Owner') {
            return res.status(403).json({ success: false, data: "The Owner account cannot be deleted." });
        }

        await run("DELETE FROM users WHERE id = ?", [id]);
        await logAction(req, 'USER_DELETE', `Deleted user: ${userToDelete.username}`);

        res.status(200).json({ success: true, data: "User deleted successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };