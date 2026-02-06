
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database.js');
const startCronJob = require('./utils/cronJob.js');

const app = express();
const PORT = process.env.PORT || 3000;

const applicantRoutes = require('./routes/applicants.js');
const branchRoutes = require('./routes/branches.js');
const deploymentRoutes = require('./routes/deployments.js');
const auditRoutes = require('./routes/audit.js'); // <-- ADD THIS LINE

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(cors());

app.use('/api', applicantRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/audit', auditRoutes); // <-- ADD THIS LINE

initDB();
startCronJob();

app.listen(PORT, () => {
    console.log(`Aloha Security System listening at http://localhost:${PORT}`);
});