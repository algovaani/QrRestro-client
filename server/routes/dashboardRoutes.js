const express = require('express');
const router = express.Router();
const { getDashboardStats, getRecentOrders, getTopItems } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/recent-orders', getRecentOrders);
router.get('/top-items', getTopItems);

module.exports = router;
