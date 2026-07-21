const express = require('express');
const router = express.Router();
const { login, getMe, getSubscriptionStatus, changePassword, changeEmail } = require('../controllers/authController');
const { protect, protectAllowExpired } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/subscription-status', protectAllowExpired, getSubscriptionStatus);
router.get('/me', protectAllowExpired, getMe);
router.put('/change-password', protect, changePassword);
router.put('/change-email', protect, changeEmail);

module.exports = router;
