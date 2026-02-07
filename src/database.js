// ================================================
// FILE: src/database.js
// ================================================
const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = process.env.VOLUME_PATH 
    ? path.join(process.env.VOLUME_PATH, 'aloha_database.db') 
    : 'aloha_database.db';

let db = null;

const connectDB = () => {
    db = new sqlite3.Database(DB_PATH, (err) => {
        if(err) console.error("DB Connection Error:", err.message);
        else console.log(`Database connected at: ${DB_PATH}`);
    });
    return db;
};

// Helper to get the current active instance
const getDB = () => {
    if (!db) return connectDB();
    return db;
};

// Helper to close connection (Promisified for await)
const closeDB = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) reject(err);
                else {
                    console.log("Database connection closed.");
                    db = null;
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
};

const initDB = () => {
    const database = getDB();
    database.serialize(() => {
        database.run('PRAGMA foreign_keys = ON;');
        
        // --- 1. Users ---
        database.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'Admin',
                security_question TEXT,
                security_answer_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- 2. Branches ---
        database.run(`
            CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                location TEXT,
                required_guards INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- 3. Applicants ---
        database.run(`
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
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- 4. Deployments ---
        database.run(`
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

        // --- 5. Audit Logs ---
        database.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                details TEXT,
                ip_address TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create default Admin if not exists
        bcrypt.hash("Admin123!", 10, (err, passHash) => {
            bcrypt.hash("aloha", 10, (err, answerHash) => {
                database.run(`INSERT OR IGNORE INTO users 
                    (username, email, password_hash, role, security_question, security_answer_hash) 
                    VALUES (?, ?, ?, ?, ?, ?)`, 
                    ["admin", "admin@aloha.com", passHash, "Admin", "What is the agency name?", answerHash]
                );
            });
        });
        
        console.log('Database tables initialized.');
    });
};

// Initial Connection
connectDB();

module.exports = { getDB, initDB, closeDB, connectDB };