const { run, all, get } = require('../utils/helper');

const deployGuard = async (req, res) => {
    try {
        const { applicant_id, branch_id } = req.body;

        if (!applicant_id || !branch_id) {
            return res.status(400).json({ success: false, data: "Applicant and Branch are required." });
        }

        const activeDeployment = await get(
            "SELECT id FROM deployments WHERE applicant_id = ? AND status = 'Active'",
            [applicant_id]
        );

        if (activeDeployment) {
            return res.status(409).json({ success: false, data: "Guard is already deployed." });
        }

        const result = await run(
            "INSERT INTO deployments (applicant_id, branch_id) VALUES (?, ?)",
            [applicant_id, branch_id]
        );

        await run("UPDATE applicants SET status = 'Hired' WHERE id = ?", [applicant_id]);

        res.status(201).json({ 
            success: true, 
            data: { id: result.lastID, message: "Guard deployed successfully" } 
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const getDeployments = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', sort = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const searchTerm = `%${search}%`;

        const totalResult = await get("SELECT COUNT(*) as count FROM deployments");
        const activeResult = await get("SELECT COUNT(*) as count FROM deployments WHERE status = 'Active'");
        const monthResult = await get("SELECT COUNT(*) as count FROM deployments WHERE strftime('%Y-%m', date_deployed) = strftime('%Y-%m', 'now')");

        let query = `
            SELECT d.id, d.status, d.date_deployed, 
                   a.first_name, a.last_name, 
                   b.name as branch_name 
            FROM deployments d
            JOIN applicants a ON d.applicant_id = a.id
            JOIN branches b ON d.branch_id = b.id
            WHERE (a.first_name LIKE ? OR a.last_name LIKE ? OR b.name LIKE ?)
        `;
        
        query += ` ORDER BY d.date_deployed ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`;

        const deployments = await all(query, [searchTerm, searchTerm, searchTerm, limit, offset]);

        const searchCountResult = await get(`
            SELECT COUNT(*) as count 
            FROM deployments d
            JOIN applicants a ON d.applicant_id = a.id
            JOIN branches b ON d.branch_id = b.id
            WHERE (a.first_name LIKE ? OR a.last_name LIKE ? OR b.name LIKE ?)
        `, [searchTerm, searchTerm, searchTerm]);

        res.status(200).json({
            success: true,
            data: {
                deployments,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(searchCountResult.count / limit),
                    total_records: searchCountResult.count
                },
                stats: {
                    total_deployments: totalResult.count,
                    total_active: activeResult.count,
                    this_month: monthResult.count
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const updateDeploymentStatus = async (req, res) => {
    try {
        const { id } = req.params; 
        const { status } = req.body; 

        if (status === 'Ended') {
            const deployment = await get("SELECT applicant_id FROM deployments WHERE id = ?", [id]);
            
            if(!deployment) {
                return res.status(404).json({success:false, data: "Deployment not found"});
            }

            await run("UPDATE deployments SET status = 'Ended' WHERE id = ?", [id]);

            await run("UPDATE applicants SET status = 'Hired' WHERE id = ?", [deployment.applicant_id]);
            
            res.status(200).json({ success: true, data: "Duty ended. Guard has been returned to the Hired pool." });
        } else {
            await run("UPDATE deployments SET status = ? WHERE id = ?", [status, id]);
            res.status(200).json({ success: true, data: "Deployment status updated successfully." });
        }

    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

const deleteDeployment = async (req, res) => {
    try {
        const { id } = req.params;
        await run("DELETE FROM deployments WHERE id = ?", [id]);
        res.status(200).json({ success: true, data: "Deployment record deleted" });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

module.exports = { deployGuard, getDeployments, updateDeploymentStatus, deleteDeployment };