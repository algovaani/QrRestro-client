const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getDynamicUPIQR,
  getUpiQrPng,
  getCombinedUPIQR,
  verifyPayment,
  verifyCombinedPayment,
  approvePayment,
  rejectPayment
} = require('../controllers/paymentController');

router.get('/upi-qr/:orderNumber/qr.png', getUpiQrPng);
router.get('/upi-qr/:orderNumber', getDynamicUPIQR);
router.post('/upi-qr/combined', getCombinedUPIQR);
router.post('/verify', verifyPayment);
router.post('/verify-combined', verifyCombinedPayment);
router.post('/approve/:orderId', protect, approvePayment);
router.post('/reject/:orderId', protect, rejectPayment);

module.exports = router;
