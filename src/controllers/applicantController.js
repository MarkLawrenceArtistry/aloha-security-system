const { run, get } = require('../utils/helper');

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

        let query = "SELECT id, first_name, last_name, status, created_at FROM applicants WHERE ";
        let params = [];

        if(id) {
            query += "id = ?";
            params.push(id);
        } else {
            query += "email = ?";
            params.push(email);
        }

        const applicant = await get(query, params);

        if(!applicant) {
            return res.status(404).json({success:false, data:"Application not found."});
        }

        return res.status(200).json({success:true, data: applicant});

    } catch(err) {
        return res.status(500).json({success:false, data:`Internal Server Error: ${err.message}`});
    }
}

module.exports = { apply, checkStatus };