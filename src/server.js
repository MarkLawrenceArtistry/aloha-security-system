const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Routes
const applicantRoutes = require('./routes/applicants.js');

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(cors());

// Mount Routes
app.use('/api', applicantRoutes);

// Initialize DB
initDB();

app.listen(PORT, () => {
    console.log(`Aloha Security System listening at http://localhost:${PORT}`);
});