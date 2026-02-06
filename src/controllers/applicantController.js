// ================================================
// FILE: src/controllers/applicantController.js
// ================================================
const { run, get, all } = require('../utils/helper');
const { logAction } = require('../utils/auditLogger'); // <-- ADD THIS LINE

// POST /api/apply
const apply = async (req, res) => {
    try {
        const { 
            first_name, last_name, email, contact_num, 
            birthdate, gender, address, position_applied, 
            years_experience, previous_employer 
        } = req.body;

        // 1. Validation: Check Files
        if (!req.files || !req.files['resume'] || !req.files['id_image']) {
            return res.status(400).json({success:false, data:"Resume and ID Image are required."});
        }

        const resumePath = `${req.protocol}://${req.get('host')}/uploads/${req.files['resume'][0].filename}`;
        const idImagePath = `${req.protocol}://${req.get('host')}/uploads/${req.files['id_image'][0].filename}`;

        // 2. Validation: Age Gating (Must be 21+)
        const birthDateObj = new Date(birthdate);
        const ageDifMs = Date.now() - birthDateObj.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        if (age < 21) {
            return res.status(400).json({success:false, data:"You must be at least 21 years old to apply."});
        }

        // 3. Validation: Duplicate Prevention
        const existing = await get(
            "SELECT id FROM applicants WHERE first_name = ? AND last_name = ? AND birthdate = ?", 
            [first_name, last_name, birthdate]
        );

        if (existing) {
            return res.status(409).json({success:false, data:"An application with this name and birthdate already exists."});
        }

        // 4. Insert to DB
        const result = await run(`
            INSERT INTO applicants (
                first_name, last_name, email, contact_num, 
                birthdate, gender, address, position_applied, 
                years_experience, previous_employer, 
                resume_path, id_image_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            first_name, last_name, email, contact_num, 
            birthdate, gender, address, position_applied, 
            years_experience, previous_employer, 
            resumePath, idImagePath
        ]);

        return res.status(201).json({success:true, data: {
            message: "Application submitted successfully!",
            applicant_id: result.lastID
        }});

    } catch(err) {
        return res.status(500).json({success:false, data:`Internal Server Error: ${err.message}`});
    }
}

// GET /api/status?email=... OR ?id=...
const checkStatus = async (req, res) => {
    try {
        const { email, id } = req.query;

        if(!email && !id) {
            return res.status(400).json({success:false, data:"Please provide an Application ID or Email to check status."});
        }

        // --- FIX STARTS HERE ---
        // Changed specific columns to * so we get ALL details (address, phone, images, etc)
        let query = "SELECT * FROM applicants WHERE ";
        let params = [];

        if(id) {
            query += "id = ?";
            params.push(id);
        } else {
            query += "email = ?";
            params.push(email);
        }

        const applicant = await get(query, params);
        // --- FIX ENDS HERE ---

        if(!applicant) {
            return res.status(404).json({success:false, data:"Application not found."});
        }

        return res.status(200).json({success:true, data: applicant});

    } catch(err) {
        return res.status(500).json({success:false, data:`Internal Server Error: ${err.message}`});
    }
}

// GET /api/applicants (Protected)
const getAllApplicants = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', sort = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const searchTerm = `%${search}%`;

        // 1. KPIs for Wireframe
        const totalRes = await get("SELECT COUNT(*) as count FROM applicants");
        const maleRes = await get("SELECT COUNT(*) as count FROM applicants WHERE gender = 'Male'");
        const femaleRes = await get("SELECT COUNT(*) as count FROM applicants WHERE gender = 'Female'");
        const monthRes = await get("SELECT COUNT(*) as count FROM applicants WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')");

        // 2. Fetch Data with Search & Pagination
        let query = `
            SELECT * FROM applicants 
            WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR position_applied LIKE ?)
        `;
        
        // Sorting logic (Wireframe has 'Date' and 'Alphabetical')
        if (sort === 'alpha') {
            query += ` ORDER BY last_name ASC`;
        } else {
            query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'}`;
        }
        
        query += ` LIMIT ? OFFSET ?`;

        const applicants = await all(query, [searchTerm, searchTerm, searchTerm, searchTerm, limit, offset]);

        // 3. Get Total Search Count for Pagination
        const countRes = await get(`
            SELECT COUNT(*) as count FROM applicants 
            WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR position_applied LIKE ?)
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);

        res.status(200).json({
            success: true,
            data: {
                applicants,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(countRes.count / limit),
                    total_records: countRes.count
                },
                stats: {
                    total: totalRes.count,
                    male: maleRes.count,
                    female: femaleRes.count,
                    this_month: monthRes.count
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// PUT /api/applicants/:id/status (Protected)
const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // e.g., "Hired", "Rejected", "For Interview"

        if (!id || !status) {
            return res.status(400).json({ success: false, data: "ID and Status are required." });
        }

        // --- AUDIT LOGGING ---
        // 1. Get applicant details BEFORE the update for a better log message.
        const applicant = await get("SELECT first_name, last_name FROM applicants WHERE id = ?", [id]);
        if (!applicant) {
            return res.status(404).json({ success: false, data: "Applicant not found." });
        }
        
        // 2. Perform the database update.
        await run("UPDATE applicants SET status = ? WHERE id = ?", [status, id]);

        // 3. Log the action.
        const details = `Admin User ID #${req.user.id} changed status of ${applicant.first_name} ${applicant.last_name} (Applicant ID: ${id}) to "${status}".`;
        await logAction(req, 'STATUS_UPDATE', details);
        // --- END AUDIT LOGGING ---

        res.status(200).json({ success: true, data: `Applicant status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};

// GET /api/dashboard-stats
const getDashboardStats = async (req, res) => {
    try {
        // 1. KPI Cards Data
        const totalReq = await get("SELECT COUNT(*) as count FROM applicants");
        const pendingReq = await get("SELECT COUNT(*) as count FROM applicants WHERE status = 'Pending'");
        
        // Active deployments (Joining deployments table)
        const deployedReq = await get("SELECT COUNT(*) as count FROM deployments WHERE status = 'Active'");

        // 2. Chart Data (Last 6 Months) - SQLite Syntax
        // Groups applicants by Month-Year
        const chartQuery = `
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
            FROM applicants 
            WHERE created_at >= date('now', '-6 months')
            GROUP BY month 
            ORDER BY month ASC
        `;
        const chartData = await all(chartQuery);

        // 3. Recent Applicants (Limit 5)
        const recent = await all("SELECT * FROM applicants ORDER BY created_at DESC LIMIT 5");

        res.status(200).json({
            success: true,
            data: {
                counts: {
                    total: totalReq.count,
                    pending: pendingReq.count,
                    active_deployments: deployedReq.count
                },
                chart: chartData, // Real array of { month: '2026-01', count: 5 }
                recent: recent
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, data: err.message });
    }
};


// Update exports
module.exports = { apply, checkStatus, getAllApplicants, updateStatus, getDashboardStats };