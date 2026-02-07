// ================================================
// FILE: src/controllers/branchController.js
// ================================================
const { run, all, get } = require('../utils/helper');
const { logAction } = require('../utils/auditLogger'); // <-- ADD THIS LINE

const createBranch = async (req, res) => {
    try {
        const { name, location, required_guards } = req.body;

        if (!name || !location) {
            return res.status(400).json({ success: false, data: "Name and Location are required." });
        }

        const result = await run(
            "INSERT INTO branches (name, location, required_guards) VALUES (?, ?, ?)",
            [name, location, required_guards || 1]
        );

        // --- AUDIT LOG ---
        const details = `Admin User ID #${req.user.id} created a new branch: "${name}" (ID: ${result.lastID}).`;
        await logAction(req, 'BRANCH_CREATE', details);
        // --- END LOG ---

        res.status(201).json({ 
            success: true, 
            data: { id: result.lastID, message: "Branch created successfully" } 
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const getBranches = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', sort = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const searchTerm = `%${search}%`;

        const totalResult = await get("SELECT COUNT(*) as count FROM branches");
        const locationsResult = await get("SELECT COUNT(DISTINCT location) as count FROM branches");
        
        let query = "SELECT * FROM branches WHERE name LIKE ? OR location LIKE ?";
        query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`;

        const branches = await all(query, [searchTerm, searchTerm, limit, offset]);
        
        const searchCountResult = await get(
            "SELECT COUNT(*) as count FROM branches WHERE name LIKE ? OR location LIKE ?", 
            [searchTerm, searchTerm]
        );

        res.status(200).json({
            success: true,
            data: {
                branches,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(searchCountResult.count / limit),
                    total_records: searchCountResult.count
                },
                stats: {
                    total_branches: totalResult.count,
                    total_locations: locationsResult.count
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, required_guards } = req.body;

        await run(
            "UPDATE branches SET name = ?, location = ?, required_guards = ? WHERE id = ?",
            [name, location, required_guards, id]
        );

        // --- AUDIT LOG ---
        const details = `Admin User ID #${req.user.id} updated branch ID #${id} to Name: "${name}".`;
        await logAction(req, 'BRANCH_UPDATE', details);
        // --- END LOG ---

        res.status(200).json({ success: true, data: "Branch updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Check existence
        const branch = await get("SELECT name FROM branches WHERE id = ?", [id]);
        if (!branch) {
            return res.status(404).json({ success: false, data: "Branch not found." });
        }
        
        // 2. Try to Delete
        try {
            await run("DELETE FROM branches WHERE id = ?", [id]);
        } catch (dbErr) {
            // HANDLE FOREIGN KEY ERROR (If guards are deployed here)
            if (dbErr.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(409).json({ 
                    success: false, 
                    data: `Cannot delete branch "${branch.name}". Guards are currently deployed here.` 
                });
            }
            throw dbErr; // Throw other errors to the main catch block
        }
        
        // 3. Log Action
        const details = `Admin User ID #${req.user.id} deleted branch: "${branch.name}" (ID: ${id}).`;
        await logAction(req, 'BRANCH_DELETE', details);

        res.status(200).json({ success: true, data: "Branch deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: "Internal Server Error" });
    }
};

module.exports = { createBranch, getBranches, updateBranch, deleteBranch };