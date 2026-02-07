// ================================================
// FILE: src/controllers/applicantController.js
// ================================================
const fs = require('fs'); // Required for file deletion
const path = require('path'); // Required for file paths
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

        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

        // --- ANTI-SPAM LOGIC (STRICT) ---
        // Check if this Email OR this IP has applied in the last 24 hours
        const lastApp = await get(
            "SELECT created_at FROM applicants WHERE email = ? OR ip_address = ? ORDER BY created_at DESC LIMIT 1", 
            [email, ip_address]
        );

        if (lastApp) {
            const lastDate = new Date(lastApp.created_at).getTime();
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000; // 24 hours

            if (now - lastDate < oneDayMs) {
                // Cleanup uploaded files immediately to save space
                if(req.files['resume']) fs.unlinkSync(req.files['resume'][0].path);
                if(req.files['id_image']) fs.unlinkSync(req.files['id_image'][0].path);

                return res.status(429).json({
                    success: false, 
                    data: "System limit reached: You (or this device) have already applied in the last 24 hours."
                });
            }
        }
        // --- ANTI-SPAM LOGIC END ---

        // 1. Validation: Check Files
        if (!req.files || !req.files['resume'] || !req.files['id_image']) {
            return res.status(400).json({success:false, data:"Resume and ID Image are required."});
        }

        const resumePath = `${req.protocol}://${req.get('host')}/uploads/${req.files['resume'][0].filename}`;
        const idImagePath = `${req.protocol}://${req.get('host')}/uploads/${req.files['id_image'][0].filename}`;

        // 2. Validation: Age Gating
        const birthDateObj = new Date(birthdate);
        const ageDifMs = Date.now() - birthDateObj.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        if (age < 21) {
            return res.status(400).json({success:false, data:"You must be at least 21 years old to apply."});
        }

        // 3. Validation: Duplicate Prevention (Name + Birthdate)
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
                resume_path, id_image_path, ip_address 
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            first_name, last_name, email, contact_num, 
            birthdate, gender, address, position_applied, 
            years_experience, previous_employer, 
            resumePath, idImagePath, ip_address // <--- Pass the IP variable here
        ]);

        return res.status(201).json({success:true, data: {
            message: "Application submitted successfully!",
            applicant_id: result.lastID
        }});

    } catch(err) {
        console.error(err);
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
        const { page = 1, limit = 10, search = '', sort = 'desc', status } = req.query; // <-- Add 'status'
        const offset = (page - 1) * limit;
        
        let query = `SELECT * FROM applicants`;
        let countQuery = `SELECT COUNT(*) as count FROM applicants`;
        let whereClauses = [];
        let params = [];
        let countParams = [];

        // --- DYNAMIC WHERE CLAUSE ---
        if (search) {
            whereClauses.push(`(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR position_applied LIKE ?)`);
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (status) {
            whereClauses.push(`status = ?`);
            params.push(status);
            countParams.push(status);
        }

        if (whereClauses.length > 0) {
            const whereString = ` WHERE ` + whereClauses.join(' AND ');
            query += whereString;
            countQuery += whereString;
        }
        // --- END DYNAMIC WHERE CLAUSE ---

        // Sorting logic
        if (sort === 'alpha') {
            query += ` ORDER BY last_name ASC`;
        } else {
            query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'}`;
        }
        
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const applicants = await all(query, params);
        const countRes = await get(countQuery, countParams);

        // KPIs for Wireframe (These are general stats, should not be filtered by the search)
        const totalRes = await get("SELECT COUNT(*) as count FROM applicants");
        const maleRes = await get("SELECT COUNT(*) as count FROM applicants WHERE gender = 'Male'");
        const femaleRes = await get("SELECT COUNT(*) as count FROM applicants WHERE gender = 'Female'");
        const monthRes = await get("SELECT COUNT(*) as count FROM applicants WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')");

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

const deleteApplicant = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query; // Check for ?force=true

        // 1. Get file paths first
        const applicant = await get("SELECT resume_path, id_image_path, first_name, last_name FROM applicants WHERE id = ?", [id]);
        
        if (!applicant) {
            return res.status(404).json({ success: false, data: "Applicant not found." });
        }

        // --- FORCE DELETE LOGIC ---
        if (force === 'true') {
            // Check if user is authorized to do this (Admin only)
            // Delete deployment records associated with this applicant
            await run("DELETE FROM deployments WHERE applicant_id = ?", [id]);
            await logAction(req, 'FORCE_DELETE_DEP', `Cascaded delete of deployments for applicant ID ${id}`);
        }
        // --- END FORCE DELETE ---

        // 2. Try to Delete from DB
        try {
            await run("DELETE FROM applicants WHERE id = ?", [id]);
        } catch (dbErr) {
            // GRACEFUL HANDLING: Check for Foreign Key Constraint
            if (dbErr.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(409).json({ 
                    success: false, 
                    data: `Cannot delete ${applicant.first_name}: Has deployment records. Use 'Delete with Deployment' option.` 
                });
            }
            throw dbErr;
        }

        // 3. Delete files if DB delete succeeded
        const UPLOAD_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../../public/uploads');
        
        const deleteFile = (urlPath) => {
            if (!urlPath) return;
            const filename = urlPath.split('/').pop();
            const filePath = path.join(UPLOAD_PATH, filename);
            fs.unlink(filePath, (err) => {
                if (err && err.code !== 'ENOENT') console.error(`Failed to delete ${filePath}`, err);
            });
        };

        deleteFile(applicant.resume_path);
        deleteFile(applicant.id_image_path);

        // 4. Log it
        const logMsg = force === 'true' 
            ? `Force deleted applicant and records: ${applicant.first_name} ${applicant.last_name}`
            : `Deleted applicant: ${applicant.first_name} ${applicant.last_name}`;
            
        await logAction(req, 'DELETE', logMsg);

        res.status(200).json({ success: true, data: "Applicant deleted." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: "Internal Server Error" });
    }
};


// Update exports
module.exports = { apply, checkStatus, getAllApplicants, updateStatus, getDashboardStats, deleteApplicant };