const express = require('express');
const router = express.Router();
const { login, getMe, getSubscriptionStatus, changePassword } = require('../controllers/authController');
const { protect, protectAllowExpired } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/subscription-status', protectAllowExpired, getSubscriptionStatus);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
