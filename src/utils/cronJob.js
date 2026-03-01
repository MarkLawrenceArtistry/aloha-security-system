// ================================================
// FILE: src/utils/cronJob.js
// ================================================
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const UPLOAD_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../../public/uploads');

// Get DB paths
const DB_PATH = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'aloha_database.db') 
    : path.join(__dirname, '../../aloha_database.db');

const AUTO_BACKUP_PATH = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'aloha_auto_backup.db') 
    : path.join(__dirname, '../../aloha_auto_backup.db');

const startCronJob = () => {
    // 1. REJECTED APPLICANTS CLEANUP (Runs every hour)
    cron.schedule('0 * * * *', () => { 
        console.log('Running cron job: Checking for expired rejected applications...');
        const retentionPeriod = 72 * 60 * 60 * 1000; 
        const cutoffDate = new Date(Date.now() - retentionPeriod).toISOString();
        const database = require('../database').getDB();

        database.all("SELECT id, resume_path, id_image_path FROM applicants WHERE status = 'Rejected' AND updated_at < ?", [cutoffDate], (err, rows) => {
            if (err) return console.error("Cron job error:", err);
            
            rows.forEach(applicant => {
                const deleteFile = (urlPath) => {
                    if (!urlPath) return;
                    const filename = urlPath.split('/').pop();
                    const filePath = path.join(UPLOAD_PATH, filename);
                    fs.unlink(filePath, (e) => { if (e && e.code !== 'ENOENT') console.error(`Failed to delete ${filePath}`, e); });
                };
                deleteFile(applicant.resume_path);
                deleteFile(applicant.id_image_path);
                database.run("DELETE FROM applicants WHERE id = ?", [applicant.id]);
            });
        });
    });

    // 2. AUTOMATED DAILY BACKUP (Runs at 11:59 PM Every Day)
    cron.schedule('59 23 * * *', () => {
        console.log('Running daily auto-backup of the database...');
        if (fs.existsSync(DB_PATH)) {
            fs.copyFile(DB_PATH, AUTO_BACKUP_PATH, (err) => {
                if (err) console.error('Auto-Backup Failed:', err);
                else console.log('Auto-Backup Successful: aloha_auto_backup.db updated.');
            });
        }
    }, {
        scheduled: true,
        timezone: "Asia/Manila" // <--- THIS IS THE MAGIC FIX
    });

    cron.schedule('0 0 * * *', () => {
        console.log('Running cron: Deleting Audit Logs older than 1 year...');
        // SQLite date('now', '-1 year') gets the exact date 1 year ago
        database.run("DELETE FROM audit_logs WHERE timestamp <= date('now', '-1 year')", function(err) {
            if (err) console.error("Cron Error (Audit Logs):", err);
            else console.log(`Audit Log Cleanup: Deleted ${this.changes} old logs.`);
        });
    }, { scheduled: true, timezone: "Asia/Manila" });

    cron.schedule('0 2 * * *', () => {
        console.log('Running cron: Hard deleting Archived records older than 3 months...');
        
        // Calculate 90 days ago
        const retentionPeriod = 90 * 24 * 60 * 60 * 1000; 
        const cutoffDate = new Date(Date.now() - retentionPeriod).toISOString();
        const database = require('../database').getDB();

        database.all("SELECT id, resume_path, id_image_path FROM applicants WHERE status = 'Archived' AND updated_at < ?", [cutoffDate], (err, rows) => {
            if (err) return console.error("Cron job error:", err);
            
            rows.forEach(applicant => {
                // Delete Files
                const deleteFile = (urlPath) => {
                    if (!urlPath) return;
                    const filename = urlPath.split('/').pop();
                    // Strip query params if they exist (e.g. ?t=TOKEN)
                    const cleanFilename = filename.split('?')[0]; 
                    const filePath = path.join(UPLOAD_PATH, cleanFilename);
                    fs.unlink(filePath, (e) => { if (e && e.code !== 'ENOENT') console.error(`Failed to delete ${filePath}`, e); });
                };
                deleteFile(applicant.resume_path);
                deleteFile(applicant.id_image_path);
                
                // Delete from DB permanently
                database.run("DELETE FROM applicants WHERE id = ?", [applicant.id]);
            });
            
            if (rows.length > 0) {
                console.log(`Hard deleted ${rows.length} expired archived applications.`);
            }
        });
    }, { scheduled: true, timezone: "Asia/Manila" });
};

module.exports = startCronJob;