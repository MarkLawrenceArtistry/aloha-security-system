const sqlite3 = require('sqlite3');
const DB_SOURCE = 'aloha_database.db';
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if(err) {
        console.log(err.message);
    }
})

const initDB = () => {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON;');

        // 1. Users (Admins)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'Admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Branches
        db.run(`
            CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                location TEXT,
                required_guards INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Applicants
        db.run(`
            CREATE TABLE IF NOT EXISTS applicants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                contact_num TEXT NOT NULL,
                birthdate TEXT NOT NULL,
                gender TEXT,
                address TEXT,
                position_applied TEXT,
                years_experience INTEGER,
                previous_employer TEXT,
                status TEXT DEFAULT 'Pending',
                resume_path TEXT,
                id_image_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Deployments
        db.run(`
            CREATE TABLE IF NOT EXISTS deployments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_id INTEGER,
                branch_id INTEGER,
                date_deployed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'Active',
                FOREIGN KEY (applicant_id) REFERENCES applicants(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id)
            );
        `);

        // 5. Audit Logs
        db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                details TEXT,
                ip_address TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create default Admin
        bcrypt.hash("Admin123!", 10, (err, hash) => {
            db.run('INSERT OR IGNORE INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
            ["admin", "admin@aloha.com", hash], function(err) {
                if(err) return;
                console.log("Default Admin created if not exists.");
            })
        })
        
        console.log('Database tables initialized.');
    })
}

module.exports = { db, initDB }