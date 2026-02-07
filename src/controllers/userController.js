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
        const { username, email, password, role } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, data: "Username, Email, and Password are required." });
        }

        // Check for duplicate
        const existing = await get("SELECT id FROM users WHERE email = ? OR username = ?", [email, username]);
        if (existing) {
            return res.status(409).json({ success: false, data: "Username or Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role || 'Admin';

        const result = await run(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            [username, email, hashedPassword, userRole]
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

        // check if user exists
        const user = await get("SELECT id FROM users WHERE id = ?", [id]);
        if (!user) return res.status(404).json({ success: false, data: "User not found." });

        // If password is provided, hash it. If not, keep existing password.
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            await run(
                "UPDATE users SET username = ?, email = ?, role = ?, password_hash = ? WHERE id = ?",
                [username, email, role, hashedPassword, id]
            );
        } else {
            await run(
                "UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?",
                [username, email, role, id]
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
        const requestingUserId = req.user.id; // From verifyToken middleware

        // Prevent self-deletion
        if (parseInt(id) === parseInt(requestingUserId)) {
            return res.status(403).json({ success: false, data: "You cannot delete your own account." });
        }

        const userToDelete = await get("SELECT username FROM users WHERE id = ?", [id]);
        if (!userToDelete) return res.status(404).json({ success: false, data: "User not found." });

        await run("DELETE FROM users WHERE id = ?", [id]);
        await logAction(req, 'USER_DELETE', `Deleted user: ${userToDelete.username}`);

        res.status(200).json({ success: true, data: "User deleted successfully." });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };