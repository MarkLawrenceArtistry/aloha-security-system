// ================================================
// FILE: src/server.js
// ================================================
require('dotenv').config();
const express = require('express');
const http = require('http'); // <-- IMPORT HTTP
const { Server } = require('socket.io'); // <-- IMPORT SOCKET.IO
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 
const helmet = require('helmet'); 
const { initDB } = require('./database.js');
const startCronJob = require('./utils/cronJob.js');

const app = express();
const server = http.createServer(app); // <-- WRAP APP IN HTTP SERVER
const io = new Server(server, {
    cors: { origin: "*" }
}); // <-- INITIALIZE SOCKET.IO

const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false
}));

const BASE_PATH = process.env.VOLUME_PATH || path.join(__dirname, '../public');
const UPLOAD_PATH = path.join(BASE_PATH, 'uploads');

if (!fs.existsSync(UPLOAD_PATH)) {
    fs.mkdirSync(UPLOAD_PATH, { recursive: true });
    console.log(`Upload directory created at: ${UPLOAD_PATH}`);
}

// --- MAKE 'io' AVAILABLE IN CONTROLLERS ---
app.use((req, res, next) => {
    req.io = io;
    next();
});

const applicantRoutes = require('./routes/applicants.js');
const branchRoutes = require('./routes/branches.js');
const deploymentRoutes = require('./routes/deployments.js');
const auditRoutes = require('./routes/audit.js');
const userRoutes = require('./routes/users.js');
const systemRoutes = require('./routes/system.js');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(UPLOAD_PATH)); 
app.use(cors());

app.use('/api', applicantRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

initDB();
startCronJob();

app.use((err, req, res, next) => {
    console.error("Internal Error:", err.message); 
    res.status(500).json({ success: false, data: "Internal Server Error" }); 
});

// --- USE server.listen INSTEAD OF app.listen ---
server.listen(PORT, () => {
    console.log(`Aloha Security System listening at http://localhost:${PORT}`);
    console.log(`Uploads are being served from: ${UPLOAD_PATH}`);
});