const Order = require('../models/Order');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');
const { emitOrderStatusUpdate, emitPaymentSuccess } = require('../socket/socketHandler');

// @desc Get all orders (filtered strictly by logged in adminId)
// @route GET /api/orders
exports.getOrders = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    const filter = adminId ? { adminId } : {};

    if (req.query.status) {
      filter.orderStatus = req.query.status;
    }
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single order by ID
// @route GET /api/orders/:id
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update Order Status
// @route PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && order.adminId && order.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify another restaurant order' });
    }

    order.orderStatus = orderStatus;
    await order.save();

    emitOrderStatusUpdate(order);

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update Payment Status
// @route PATCH /api/orders/:id/payment
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && order.adminId && order.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    order.paymentStatus = paymentStatus;
    if (paymentStatus === 'Paid') {
      order.paidAt = new Date();
      if (order.orderStatus === 'New') {
        order.orderStatus = 'Confirmed';
      }
    } else if (paymentStatus === 'Unpaid') {
      order.transactionId = '';
      order.paidAt = null;
    }
    await order.save();

    if (paymentStatus === 'Paid') {
      emitPaymentSuccess(order);
      emitOrderStatusUpdate(order);
    } else {
      emitOrderStatusUpdate(order);
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete Order
// @route DELETE /api/orders/:id
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && order.adminId && order.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await order.deleteOne();

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get Kitchen Pending Orders (filtered strictly by adminId)
// @route GET /api/orders/kitchen
exports.getKitchenOrders = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    const filter = adminId ? { adminId } : {};
    filter.orderStatus = { $in: ['New', 'Confirmed', 'Preparing', 'Ready'] };

    const orders = await Order.find(filter).sort({ createdAt: 1 });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    next(error);
  }
};
