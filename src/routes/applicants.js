const express = require('express');
const router = express.Router();
const applicantController = require('../controllers/applicantController');
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');
const { verifyToken } = require('../middleware/authMiddleware');

const uploadFields = upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'id_image', maxCount: 1 }]);

// Public Routes
router.post('/apply', uploadFields, applicantController.apply);
router.get('/status', applicantController.checkStatus);
router.post('/auth/login', authController.login);
router.get('/dashboard-stats', verifyToken, applicantController.getDashboardStats);

// Admin Routes (Protected)
router.get('/applicants', verifyToken, applicantController.getAllApplicants);
router.put('/applicants/:id/status', verifyToken, applicantController.updateStatus);

// Add this route
router.delete('/applicants/:id', verifyToken, applicantController.deleteApplicant);

module.exports = router;