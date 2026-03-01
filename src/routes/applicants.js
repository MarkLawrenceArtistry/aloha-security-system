const express = require('express');
const router = express.Router();
const applicantController = require('../controllers/applicantController');
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { applicationLimiter, loginLimiter } = require('../middleware/rateLimiter');

const uploadFields = upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'id_image', maxCount: 1 }]);

// Public Routes
router.post('/apply', applicationLimiter, uploadFields, applicantController.apply);
router.get('/status', applicantController.checkStatus);
router.post('/auth/login', loginLimiter, authController.login);
router.get('/dashboard-stats', verifyToken, applicantController.getDashboardStats);

// Admin Routes (Protected)
router.get('/applicants', verifyToken, applicantController.getAllApplicants);
router.put('/applicants/:id/status', verifyToken, applicantController.updateStatus);
router.delete('/applicants/:id', verifyToken, verifyAdmin, applicantController.deleteApplicant);

router.get('/applicants/:id/pdf', verifyToken, verifyAdmin, applicantController.exportApplicantPdf);

router.post('/auth/forgot-password-init', authController.getSecurityQuestion);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/profile', verifyToken, authController.getProfile);
router.put('/auth/update-profile', verifyToken, authController.updateProfile); // For Settings Page

router.post('/auth/reset-master-key', authController.resetViaMasterKey);
router.post('/auth/forgot-password-otp-send', authController.sendPasswordOtp);
router.post('/auth/forgot-password-otp-verify', authController.resetViaOtp);


module.exports = router;