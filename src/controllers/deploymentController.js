// ================================================
// FILE: src/controllers/deploymentController.js
// ================================================
const { run, all, get } = require('../utils/helper');
const { logAction } = require('../utils/auditLogger'); // <-- ADD THIS LINE
const PDFDocument = require('pdfkit');
const { sendDeploymentEmail } = require('../utils/emailService');

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

        // --- FETCH DATA FOR LOGS & EMAILS ---
        // Added 'email' for the applicant, and 'location', 'contact_person' for the branch
        const applicant = await get("SELECT first_name, last_name, email FROM applicants WHERE id = ?", [applicant_id]);
        const branch = await get("SELECT name, location, contact_person FROM branches WHERE id = ?", [branch_id]);

        const result = await run(
            "INSERT INTO deployments (applicant_id, branch_id) VALUES (?, ?)",
            [applicant_id, branch_id]
        );

        await run("UPDATE applicants SET status = 'Hired' WHERE id = ?", [applicant_id]);

        if (applicant && branch) {
            // 1. Audit Log
            const details = `Admin User ID #${req.user.id} deployed ${applicant.first_name} ${applicant.last_name} to branch "${branch.name}".`;
            await logAction(req, 'DEPLOYMENT_CREATE', details);

            // 2. Fire off the email asynchronously (don't await, so it doesn't slow down the UI response)
            sendDeploymentEmail(applicant, branch);
        }

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

            // --- AUDIT LOG ---
            const applicant = await get("SELECT first_name, last_name FROM applicants WHERE id = ?", [deployment.applicant_id]);
            // --- END LOG PREP ---

            await run("UPDATE deployments SET status = 'Ended' WHERE id = ?", [id]);
            await run("UPDATE applicants SET status = 'Hired' WHERE id = ?", [deployment.applicant_id]);
            
            // --- AUDIT LOG ---
            if(applicant) {
                const details = `Admin User ID #${req.user.id} ended the deployment for ${applicant.first_name} ${applicant.last_name}.`;
                await logAction(req, 'DEPLOYMENT_END', details);
            }
            // --- END LOG ---

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

const generateReport = async (req, res) => {
    try {
        // 1. Fetch Active Deployments
        const query = `
            SELECT d.date_deployed, a.first_name, a.last_name, b.name as branch_name, b.location
            FROM deployments d
            JOIN applicants a ON d.applicant_id = a.id
            JOIN branches b ON d.branch_id = b.id
            WHERE d.status = 'Active'
            ORDER BY b.name ASC
        `;
        const deployments = await all(query);

        // 2. Setup PDF Stream
        const doc = new PDFDocument({ margin: 50 });
        
        // Set headers so browser knows it's a PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=deployment_report.pdf');

        doc.pipe(res); // Pipe PDF output directly to the response

        // 3. Document Header
        doc.fontSize(20).text('Aloha Security Agency', { align: 'center' });
        doc.fontSize(12).text('Official Deployment Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated by: Admin #${req.user.id}`, { align: 'right' });
        doc.text(`Date: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown(2);

        // 4. Draw Table Headers
        const tableTop = 150;
        const col1 = 50;  // Guard Name
        const col2 = 200; // Branch
        const col3 = 400; // Location
        
        doc.font('Helvetica-Bold');
        doc.text('Guard Name', col1, tableTop);
        doc.text('Assigned Branch', col2, tableTop);
        doc.text('Location', col3, tableTop);
        
        // Draw Line
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // 5. Loop Data
        let y = tableTop + 25;
        doc.font('Helvetica');

        deployments.forEach(d => {
            // Check if we need a new page
            if (y > 700) {
                doc.addPage();
                y = 50;
            }

            doc.text(`${d.first_name} ${d.last_name}`, col1, y);
            doc.text(d.branch_name, col2, y, { width: 180 }); // wrap text
            doc.text(d.location, col3, y, { width: 150 });
            
            y += 30; // Row height
        });

        // 6. Footer & Stats
        doc.moveDown(2);
        doc.font('Helvetica-Bold').text(`Total Active Guards: ${deployments.length}`, 50, y + 20);

        // 7. Audit Log
        await logAction(req, 'REPORT_GEN', `Generated PDF deployment report.`);

        doc.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, data: "Failed to generate PDF." });
    }
};

// Export the new function
module.exports = { deployGuard, getDeployments, updateDeploymentStatus, deleteDeployment, generateReport };