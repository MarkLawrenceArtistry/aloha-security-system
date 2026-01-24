const express = require('express');
const router = express.Router();

const applicantController = require('../controllers/applicantController');
const upload = require('../middleware/upload');

// Handle multiple files: 'resume' and 'id_image'
const uploadFields = upload.fields([
    { name: 'resume', maxCount: 1 }, 
    { name: 'id_image', maxCount: 1 }
]);

// POST /api/apply
router.post('/apply', uploadFields, applicantController.apply);

// GET /api/status
router.get('/status', applicantController.checkStatus);

module.exports = router;