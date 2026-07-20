const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, updateOrderStatus, updatePaymentStatus, deleteOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/payment', updatePaymentStatus);
router.delete('/:id', deleteOrder);

module.exports = router;
