// ================================================
// FILE: src/utils/cronJob.js
// ================================================
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { db } = require('../database'); // Ensure this imports the active db instance properly
// If using the helper pattern, you might need to import getDB or pass the DB instance. 
// Assuming your current import works:

const UPLOAD_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../../public/uploads');

const startCronJob = () => {
    // Schedule: Runs every hour (0 * * * *) to check for cleanups
    cron.schedule('0 * * * *', () => { 
        console.log('Running cron job: Checking for expired rejected applications...');
        
        // FIXED: 72 Hours (3 Days) Logic
        const retentionPeriod = 72 * 60 * 60 * 1000; 
        const cutoffDate = new Date(Date.now() - retentionPeriod).toISOString();
        
        // FIXED QUERY: Checks 'updated_at', not 'created_at'
        const query = "SELECT id, resume_path, id_image_path FROM applicants WHERE status = 'Rejected' AND updated_at < ?";

        // Note: You need to access the DB instance correctly. 
        // If 'db' is null, use the getter from database.js
        const database = require('../database').getDB();

        database.all(query, [cutoffDate], (err, rows) => {
            if (err) {
                console.error("Cron job error:", err);
                return;
            }

            if (rows.length > 0) {
                 console.log(`Found ${rows.length} expired rejected applications to delete.`);
            }

            rows.forEach(applicant => {
                // 1. Delete Files
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

                // 2. Delete Record
                database.run("DELETE FROM applicants WHERE id = ?", [applicant.id]);
            });
        });
    });
};

module.exports = startCronJob;