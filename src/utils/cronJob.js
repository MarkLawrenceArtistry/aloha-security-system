const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { db } = require('../database');

const startCronJob = () => {
    cron.schedule('0 0 */3 * *', () => { 
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        
        db.all("SELECT id, resume_path, id_image_path FROM applicants WHERE status = 'Rejected' AND created_at < ?", [threeDaysAgo], (err, rows) => {
            if (err) return;

            rows.forEach(applicant => {
                const deleteFile = (urlPath) => {
                    if (!urlPath) return;
                    const filename = urlPath.split('/').pop();
                    const filePath = path.join(__dirname, '../../public/uploads', filename);
                    
                    fs.unlink(filePath, (err) => {
                        if (err && err.code !== 'ENOENT') console.error(err);
                    });
                };

                deleteFile(applicant.resume_path);
                deleteFile(applicant.id_image_path);

                db.run("DELETE FROM applicants WHERE id = ?", [applicant.id]);
            });
        });
    });
};

module.exports = startCronJob;