// ================================================
// FILE: src/controllers/applicantController.js
// ================================================
const fs = require('fs'); // Required for file deletion
const path = require('path'); // Required for file paths
const { run, get, all } = require('../utils/helper');
const { logAction } = require('../utils/auditLogger');
const { sendStatusEmail } = require('../utils/emailService');
const PDFDocument = require('pdfkit');
const { encrypt, decrypt, hashData } = require('../utils/crypto');

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
            
            // CHANGED: From 24 hours to 2 hours
            const timeLimitMs = 2 * 60 * 60 * 1000; // 2 hours

            if (now - lastDate < timeLimitMs) {
                // Cleanup uploaded files immediately to save space
                if(req.files['resume']) fs.unlinkSync(req.files['resume'][0].path);
                if(req.files['id_image']) fs.unlinkSync(req.files['id_image'][0].path);

                return res.status(429).json({
                    success: false, 
                    data: "System limit reached: You have already applied recently. Please try again in 2 hours."
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
        const emailHash = hashData(email); // <--- Create Hash
        
        const existing = await get(
            "SELECT id FROM applicants WHERE email_hash = ?", // <--- Check Hash
            [emailHash]
        );

        if (existing) {
            return res.status(409).json({success:false, data:"An application with this email address already exists."});
        }

        const resumeHash = req.files['resume'][0].fileHash;
        const idHash = req.files['id_image'][0].fileHash;

        const existingFile = await get(
            "SELECT id FROM applicants WHERE resume_hash = ? OR id_image_hash = ?", 
            [resumeHash, idHash]
        );

        if (existingFile) {
            // Delete the files from disk since we are rejecting them
            fs.unlinkSync(req.files['resume'][0].path);
            fs.unlinkSync(req.files['id_image'][0].path);
            return res.status(409).json({
                success:false, 
                data: "SECURITY ALERT: These exact documents have already been submitted to our system. Duplicate applications are not allowed."
            });
        }

        // 4. Insert to DB
        const result = await run(`
            INSERT INTO applicants (
                first_name, last_name, email, contact_num, 
                birthdate, gender, address, position_applied, 
                years_experience, previous_employer, 
                resume_path, id_image_path, ip_address,
                resume_hash, id_image_hash, email_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            first_name, last_name, 
            encrypt(email),          // <--- Encrypt
            encrypt(contact_num),    // <--- Encrypt
            encrypt(birthdate),      // <--- Encrypt
            gender, 
            encrypt(address),        // <--- Encrypt
            position_applied, 
            years_experience, 
            encrypt(previous_employer), // <--- Encrypt
            resumePath, idImagePath, ip_address,
            resumeHash, idHash, 
            emailHash                // <--- Store Hash
        ]);

        if (req.io) {
            req.io.emit('new_application', {
                name: `${first_name} ${last_name}`,
                position: position_applied
            });
        }

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

        let applicant = null;

        if (id) {
            applicant = await get("SELECT * FROM applicants WHERE id = ?", [id]);
        } else if (email) {
            // Hash the input email to find it in DB
            const lookupHash = hashData(email);
            applicant = await get("SELECT * FROM applicants WHERE email_hash = ?", [lookupHash]);
        }

        if(!applicant) {
            return res.status(404).json({success:false, data:"Application not found."});
        }

        // DECRYPT DATA BEFORE SENDING BACK
        const decryptedApplicant = {
            ...applicant,
            email: decrypt(applicant.email),
            contact_num: decrypt(applicant.contact_num),
            address: decrypt(applicant.address),
            birthdate: decrypt(applicant.birthdate),
            previous_employer: decrypt(applicant.previous_employer)
        };

        return res.status(200).json({success:true, data: decryptedApplicant});

    } catch(err) {
        return res.status(500).json({success:false, data:`Internal Server Error: ${err.message}`});
    }
}

// GET /api/applicants (Protected)
const getAllApplicants = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', sort = 'desc', status } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `SELECT * FROM applicants`;
        let countQuery = `SELECT COUNT(*) as count FROM applicants`;
        
        let whereClauses = [];
        let params = [];
        let countParams = [];

        const { available_only } = req.query; // Add this destructure at the top of the function

        if (status === 'Archived') {
            if (req.user.role === 'Staff') return res.status(403).json({ success: false, data: "Admins only." });
            whereClauses.push(`status = 'Archived'`);
        } 
        else if (status === 'Hired') {
            whereClauses.push(`status = 'Hired'`);
            
            // NEW FIX: If requested by the deployment form, exclude guards currently on duty
            if (available_only === 'true') {
                whereClauses.push(`id NOT IN (SELECT applicant_id FROM deployments WHERE status = 'Active')`);
            }
        }
        else if (status) {
            whereClauses.push(`status = ?`); // Pending, Rejected, For Interview
            params.push(status);
            countParams.push(status);
        }
        else {
            // Default Applicants page (No status clicked): Hide Hired and Archived
            whereClauses.push(`status NOT IN ('Archived', 'Hired')`);
        }

        // --- 2. SEARCH FILTERING ---
        if (search) {
            const searchTerm = `%${search}%`;
            
            // If they typed an '@', assume they are searching for an exact email
            if (search.includes('@')) {
                const { hashData } = require('../utils/crypto');
                const searchHash = hashData(search);
                whereClauses.push(`email_hash = ?`);
                params.push(searchHash);
                countParams.push(searchHash);
            } else {
                // Otherwise, search Name and Position (which are unencrypted for this exact reason)
                whereClauses.push(`(first_name LIKE ? OR last_name LIKE ? OR position_applied LIKE ?)`);
                params.push(searchTerm, searchTerm, searchTerm);
                countParams.push(searchTerm, searchTerm, searchTerm);
            }
        }

        // Apply WHERE to queries
        if (whereClauses.length > 0) {
            const whereString = ` WHERE ` + whereClauses.join(' AND ');
            query += whereString;
            countQuery += whereString;
        }

        // --- 3. SORTING ---
        query += ` ORDER BY created_at ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const applicantsRaw = await all(query, params);
        const applicants = applicantsRaw.map(app => ({
            ...app,
            email: decrypt(app.email),
            contact_num: decrypt(app.contact_num),
            address: decrypt(app.address),
        }));
        const countRes = await get(countQuery, countParams);

        // --- 4. KPIs (Exclude Archived and Hired) ---
        const totalRes = await get("SELECT COUNT(*) as count FROM applicants WHERE status NOT IN ('Archived', 'Hired')");
        const maleRes = await get("SELECT COUNT(*) as count FROM applicants WHERE gender = 'Male' AND status NOT IN ('Archived', 'Hired')");
        const femaleRes = await get("SELECT COUNT(*) as count FROM applicants WHERE gender = 'Female' AND status NOT IN ('Archived', 'Hired')");
        const archivedRes = await get("SELECT COUNT(*) as count FROM applicants WHERE status = 'Archived'");

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
                    archived: archivedRes.count
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: err.message });
    }
};

// PUT /api/applicants/:id/status (Protected)
const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, message } = req.body; 

        if (!id || !status) {
            return res.status(400).json({ success: false, data: "ID and Status are required." });
        }

        // 1. Get Applicant Details 
        const applicant = await get("SELECT * FROM applicants WHERE id = ?", [id]);
        if (!applicant) {
            return res.status(404).json({ success: false, data: "Applicant not found." });
        }
        
        // 2. Update DB
        await run("UPDATE applicants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);

        const details = `Admin User ID #${req.user.id} changed status of ${applicant.first_name} ${applicant.last_name} to "${status}".`;
        await logAction(req, 'STATUS_UPDATE', details);

        // 3. DECRYPT EMAIL BEFORE SENDING!
        applicant.email = decrypt(applicant.email);

        // 4. Send Email 
        sendStatusEmail(applicant, status, message);

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
        const deployedReq = await get("SELECT COUNT(*) as count FROM deployments WHERE status = 'Active'");

        // 2. Chart Data (Last 6 Months)
        const chartQuery = `
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
            FROM applicants 
            WHERE created_at >= date('now', '-6 months')
            GROUP BY month 
            ORDER BY month ASC
        `;
        const chartData = await all(chartQuery);

        // 3. Recent Applicants
        const recent = await all("SELECT * FROM applicants ORDER BY created_at DESC LIMIT 5");

        // 4. SYSTEM HEALTH LOGIC (NEW)
        const DB_PATH = process.env.VOLUME_PATH
            ? path.join(process.env.VOLUME_PATH, 'aloha_database.db')
            : path.join(__dirname, '../../aloha_database.db');

        const UPLOAD_PATH = process.env.VOLUME_PATH 
            ? path.join(process.env.VOLUME_PATH, 'uploads')
            : path.join(__dirname, '../../public/uploads');

        let totalSizeBytes = 0;

        // Get DB Size
        if (fs.existsSync(DB_PATH)) {
            const stats = fs.statSync(DB_PATH);
            totalSizeBytes += stats.size;
        }

        // Get Uploads Folder Size
        if (fs.existsSync(UPLOAD_PATH)) {
            const files = fs.readdirSync(UPLOAD_PATH);
            files.forEach(file => {
                const filePath = path.join(UPLOAD_PATH, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) totalSizeBytes += stats.size;
            });
        }

        const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
        // ------------------------------------
        
        const AUTO_BACKUP_PATH = process.env.VOLUME_PATH
            ? path.join(process.env.VOLUME_PATH, 'aloha_auto_backup.db')
            : path.join(__dirname, '../../aloha_auto_backup.db');

        let lastBackup = "No automated backup yet";
        if (fs.existsSync(AUTO_BACKUP_PATH)) {
            const backupStats = fs.statSync(AUTO_BACKUP_PATH);
            lastBackup = backupStats.mtime.toLocaleString();
        }

        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeStr = `${hours}h ${minutes}m`;

        // CALCULATE TIME UNTIL MIDNIGHT (Next Maintenance)
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0); 
        const msUntilMidnight = midnight - now;
        const maintHours = Math.floor(msUntilMidnight / (1000 * 60 * 60));
        const maintMins = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));
        const nextMaintenanceStr = `In ${maintHours}h ${maintMins}m`;

        const oldestArchived = await get("SELECT updated_at FROM applicants WHERE status = 'Archived' ORDER BY updated_at ASC LIMIT 1");
        let nextPurgeStr = "No pending purges";
        if (oldestArchived) {
            const purgeDate = new Date(new Date(oldestArchived.updated_at).getTime() + (90 * 24 * 60 * 60 * 1000));
            const daysLeft = Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24));
            nextPurgeStr = daysLeft > 0 ? `In ${daysLeft} Days` : "Purge Pending";
        }

        res.status(200).json({
            success: true,
            data: {
                counts: {
                    total: totalReq.count,
                    pending: pendingReq.count,
                    active_deployments: deployedReq.count
                },
                system_health: {
                    uptime: uptimeStr,
                    db_size: totalSizeMB,
                    last_backup: lastBackup,
                    next_maintenance: nextMaintenanceStr,
                    next_purge: nextPurgeStr // <-- Add this to payload
                },
                chart: chartData, 
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
        const { reason } = req.body; // Catch the reason from the frontend

        if (!reason) {
            return res.status(400).json({ success: false, data: "A reason for deletion is required." });
        }

        const applicant = await get("SELECT first_name, last_name FROM applicants WHERE id = ?", [id]);
        if (!applicant) {
            return res.status(404).json({ success: false, data: "Applicant not found." });
        }

        // 1. FREE THE BRANCH (Delete any active deployments for this user)
        await run("DELETE FROM deployments WHERE applicant_id = ?", [id]);

        // 2. SOFT DELETE (Change status to Archived and update timestamp)
        await run("UPDATE applicants SET status = 'Archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

        // 3. AUDIT LOG WITH REASON
        const logMsg = `Deleted applicant: ${applicant.first_name} ${applicant.last_name}. Reason: ${reason}`;
        await logAction(req, 'DELETE_ARCHIVE', logMsg);

        res.status(200).json({ success: true, data: "Applicant archived successfully." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: "Internal Server Error" });
    }
};

const exportApplicantPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const app = await get("SELECT * FROM applicants WHERE id = ?", [id]);
        
        if (!app) return res.status(404).json({ success: false, data: "Applicant not found." });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Dossier_${app.last_name}_${app.first_name}.pdf`);
        doc.pipe(res);

        // Header
        doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('ALOHA SECURITY AGENCY', { align: 'center' });
        doc.font('Helvetica').fontSize(12).fillColor('#64748b').text('Official Applicant Dossier (Archived Record)', { align: 'center' });
        doc.moveDown(2);

        // Details
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Personal Information');
        doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1.5);

        const drawRow = (label, value) => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text(`${label}:`, { continued: true, width: 150 });
            doc.font('Helvetica').fillColor('#0f172a').text(` ${value || 'N/A'}`);
            doc.moveDown(0.5);
        };

        drawRow('Full Name', `${app.first_name} ${app.last_name}`);
        drawRow('Email Address', app.email);
        drawRow('Contact Number', app.contact_num);
        drawRow('Birthdate', app.birthdate);
        drawRow('Gender', app.gender);
        drawRow('Address', app.address);
        doc.moveDown(1);

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Professional Background');
        doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1.5);

        drawRow('Applied Position', app.position_applied);
        drawRow('Years of Experience', `${app.years_experience} Years`);
        drawRow('Previous Employer', app.previous_employer);
        drawRow('Current Status', app.status);
        drawRow('Application Date', new Date(app.created_at).toLocaleString());
        drawRow('Last Updated', new Date(app.updated_at).toLocaleString());

        doc.moveDown(3);
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#94a3b8').text('This document was generated securely from the Aloha Security Management System and is strictly confidential.', { align: 'center' });

        await logAction(req, 'EXPORT_PDF', `Exported dossier for Archived ID #${id}`);
        doc.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: "PDF Generation failed." });
    }
};

const directHire = async (req, res) => {
    try {
        const { 
            first_name, last_name, email, contact_num, 
            birthdate, gender, address, position_applied, 
            years_experience, previous_employer 
        } = req.body;

        // --- ADD STRICT EMAIL CHECK HERE ---
        const existing = await get("SELECT id FROM applicants WHERE email = ?", [email]);
        if (existing) {
            return res.status(409).json({ success: false, data: "A guard with this email already exists in the system." });
        }
        // -----------------------------------
        
        // Files are optional for Admin Direct Imports
        let resumePath = null;
        let idImagePath = null;
        let resumeHash = null;
        let idHash = null;

        if (req.files && req.files['resume']) {
            resumePath = `${req.protocol}://${req.get('host')}/uploads/${req.files['resume'][0].filename}`;
            resumeHash = req.files['resume'][0].fileHash;
        }
        if (req.files && req.files['id_image']) {
            idImagePath = `${req.protocol}://${req.get('host')}/uploads/${req.files['id_image'][0].filename}`;
            idHash = req.files['id_image'][0].fileHash;
        }

        const result = await run(`
            INSERT INTO applicants (
                first_name, last_name, email, contact_num, birthdate, gender, address, position_applied, 
                years_experience, previous_employer, status, resume_path, id_image_path, ip_address,
                resume_hash, id_image_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Hired', ?, ?, 'Admin_Import', ?, ?)
        `, [
            first_name, last_name, email, contact_num, birthdate, gender, address, position_applied, 
            years_experience || 0, previous_employer || 'N/A', resumePath, idImagePath, resumeHash, idHash
        ]);

        await logAction(req, 'DIRECT_HIRE', `Admin imported existing guard: ${first_name} ${last_name}`);
        
        res.status(201).json({ success: true, data: "Guard added directly to active roster." });
    } catch(err) {
        console.error(err);
        res.status(500).json({ success: false, data: err.message });
    }
};

// DON'T FORGET TO UPDATE MODULE.EXPORTS
module.exports = { apply, checkStatus, getAllApplicants, updateStatus, getDashboardStats, deleteApplicant, exportApplicantPdf, directHire };