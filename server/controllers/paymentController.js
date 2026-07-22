const Order = require('../models/Order');
const Setting = require('../models/Setting');
const { generateQRCode, generateQRCodeBuffer } = require('../utils/qrGenerator');
const { buildUpiPayString } = require('../utils/upiHelper');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');
const { emitPaymentPending, emitPaymentSuccess, emitOrderStatusUpdate } = require('../socket/socketHandler');

const getBillMeta = (settings) => ({
  restaurantName: settings.restaurantName || 'Royal Spice Restaurant',
  taxLabel: `GST Tax (${settings.taxPercentage || 5}%)`,
  contactNumber: settings.mobile || ''
});

// @desc Generate Dynamic UPI QR Code for Order Grand Total
// @route GET /api/payment/upi-qr/:orderNumber
exports.getDynamicUPIQR = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const settings = await Setting.findOne({ adminId: order.adminId }) || {};
    const upiId = settings.upiId || 'royalspice@upi';
    const restaurantName = settings.restaurantName || 'Royal Spice Restaurant';
    const grandTotal = order.grandTotal;

    const upiString = buildUpiPayString({
      upiId,
      payeeName: restaurantName,
      amount: grandTotal,
      note: orderNumber
    });

    const qrCodeDataUrl = await generateQRCode(upiString);

    res.json({
      success: true,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      grandTotal: order.grandTotal,
      paymentStatus: order.paymentStatus,
      upiId,
      restaurantName,
      upiString,
      qrCodeDataUrl
    });
  } catch (error) {
    next(error);
  }
};

// @desc Serve UPI QR as PNG (for WhatsApp link / direct image share)
// @route GET /api/payment/upi-qr/:orderNumber/qr.png
exports.getUpiQrPng = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const settings = await Setting.findOne({ adminId: order.adminId }) || {};
    const upiId = settings.upiId || 'royalspice@upi';
    const restaurantName = settings.restaurantName || 'Royal Spice Restaurant';

    const upiString = buildUpiPayString({
      upiId,
      payeeName: restaurantName,
      amount: order.grandTotal,
      note: orderNumber
    });

    const pngBuffer = await generateQRCodeBuffer(upiString);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="payment-${orderNumber}.png"`,
      'Cache-Control': 'public, max-age=300'
    });
    res.send(pngBuffer);
  } catch (error) {
    next(error);
  }
};

// @desc Customer submits UPI payment for admin approval
// @route POST /api/payment/verify
exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderNumber, transactionId, paymentMethod } = req.body;

    let order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'Paid') {
      const settings = await Setting.findOne({ adminId: order.adminId }) || {};
      return res.json({
        success: true,
        message: 'Payment already approved',
        order,
        bill: getBillMeta(settings)
      });
    }

    if (order.paymentStatus === 'Pending') {
      return res.json({
        success: true,
        message: 'Payment already submitted and waiting for admin approval',
        order,
        pending: true
      });
    }

    const txnId = (transactionId && String(transactionId).trim()) || `TXN${Date.now()}`;
    const method = paymentMethod || 'UPI';

    order.paymentStatus = 'Pending';
    order.paymentMethod = method;
    order.transactionId = txnId;
    order.paidAt = null;

    await order.save();

    emitPaymentPending(order);

    res.json({
      success: true,
      message: 'Payment submitted! Waiting for admin approval.',
      order,
      pending: true
    });
  } catch (error) {
    next(error);
  }
};

// @desc Admin approves pending payment
// @route POST /api/payment/approve/:orderId
exports.approvePayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && order.adminId && order.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.paymentStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'No pending payment to approve' });
    }

    order.paymentStatus = 'Paid';
    order.paidAt = new Date();
    if (order.orderStatus !== 'Cancelled' && order.orderStatus !== 'Completed') {
      order.orderStatus = 'Completed';
    }

    await order.save();

    const settings = await Setting.findOne({ adminId: order.adminId }) || {};

    emitPaymentSuccess(order);
    emitOrderStatusUpdate(order);

    res.json({
      success: true,
      message: 'Payment approved and order completed',
      order,
      bill: getBillMeta(settings)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Admin rejects pending payment
// @route POST /api/payment/reject/:orderId
exports.rejectPayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && order.adminId && order.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.paymentStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'No pending payment to reject' });
    }

    order.paymentStatus = 'Unpaid';
    order.transactionId = '';
    order.paidAt = null;

    await order.save();

    emitOrderStatusUpdate(order);

    res.json({
      success: true,
      message: 'Payment rejected. Customer can try again.',
      order
    });
  } catch (error) {
    next(error);
  }
};
