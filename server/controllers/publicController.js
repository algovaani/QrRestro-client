const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const { emitNewOrder, emitOrderRating } = require('../socket/socketHandler');
const { generateOrderBillPdfBuffer } = require('../utils/billPdf');
const { getPublicBillPdfUrl } = require('../utils/publicApiUrl');

const generateOrderNumber = () => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${randomNum}`;
};

const findActiveTable = async (tableNumber, adminId) => {
  if (adminId) {
    return Table.findOne({ adminId, tableNumber, status: 'Active' });
  }

  const tables = await Table.find({ tableNumber, status: 'Active' });
  if (tables.length === 0) return null;
  if (tables.length > 1) {
    const error = new Error('Multiple restaurants use this table number. Please scan the QR code placed on your table.');
    error.status = 409;
    throw error;
  }
  return tables[0];
};

const findTableForOrder = async (tableNumber, adminId) => {
  if (adminId) {
    return Table.findOne({ adminId, tableNumber });
  }

  const tables = await Table.find({ tableNumber });
  if (tables.length === 0) return null;
  if (tables.length > 1) {
    const error = new Error('Restaurant could not be identified. Please scan the QR code from your table again.');
    error.status = 409;
    throw error;
  }
  return tables[0];
};

const buildMenuResponse = async (table) => {
  const adminId = table.adminId;
  const categories = await Category.find({ adminId, status: 'Active' }).sort({ displayOrder: 1 });
  const menuItems = await MenuItem.find({ adminId, status: 'Active', isAvailable: true }).populate('category');
  const setting = await Setting.findOne({ adminId }) || {};

  return {
    success: true,
    table,
    tableNumber: table.tableNumber,
    adminId,
    categories,
    menuItems,
    setting
  };
};

// @desc Get table info & public menu (tenant-scoped)
// @route GET /api/public/menu/:adminId/table/:tableNumber
exports.getPublicMenuByAdmin = async (req, res, next) => {
  try {
    const { adminId, tableNumber } = req.params;
    const table = await findActiveTable(tableNumber, adminId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found or inactive' });
    }
    res.json(await buildMenuResponse(table));
  } catch (error) {
    next(error);
  }
};

// @desc Legacy menu route (table number only)
// @route GET /api/public/menu/:tableNumber
exports.getTableInfo = async (req, res, next) => {
  try {
    const { tableNumber } = req.params;
    const table = await findActiveTable(tableNumber);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found or inactive' });
    }
    res.json(await buildMenuResponse(table));
  } catch (error) {
    next(error);
  }
};

exports.getPublicMenu = exports.getTableInfo;

// @desc Place public customer order
// @route POST /api/public/orders
exports.placeOrder = async (req, res, next) => {
  try {
    const { tableNumber, adminId, customerName, customerMobile, items, notes, paymentMethod } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, message: 'Customer Full Name is strictly required before placing order.' });
    }

    if (!customerMobile || !/^\d{10}$/.test(customerMobile.trim())) {
      return res.status(400).json({ success: false, message: 'A valid 10-digit Customer Mobile Number is required.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order cart cannot be empty' });
    }

    const table = await findTableForOrder(tableNumber, adminId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Invalid table number' });
    }

    const tenantAdminId = table.adminId;
    const setting = await Setting.findOne({ adminId: tenantAdminId }) || { taxPercentage: 5 };

    let subtotal = 0;
    const processedItems = items.map(item => {
      const itemPrice = Number(item.price) || 0;
      const itemQty = Number(item.quantity) || 1;
      const itemTotal = itemPrice * itemQty;
      subtotal += itemTotal;

      return {
        menuItem: item.menuItemId || item.id || item._id,
        itemName: item.itemName || item.name || item.title || 'Food Item',
        size: item.size || 'Full',
        quantity: itemQty,
        price: itemPrice,
        total: itemTotal,
        instructions: item.instructions || ''
      };
    });

    const taxPercentage = setting.taxPercentage || 5;
    const tax = Math.round((subtotal * taxPercentage) / 100);
    const grandTotal = subtotal + tax;

    const orderNumber = generateOrderNumber();

    const preferredPayment = ['UPI', 'Cash', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI';

    const order = await Order.create({
      adminId: tenantAdminId,
      orderNumber,
      tableNumber,
      table: table._id,
      customerName: customerName.trim(),
      customerMobile: customerMobile.trim(),
      items: processedItems,
      subtotal,
      tax,
      grandTotal,
      orderStatus: 'New',
      paymentStatus: 'Unpaid',
      paymentMethod: preferredPayment,
      notes: notes || ''
    });

    try {
      emitNewOrder(order);
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.createPublicOrder = exports.placeOrder;

// @desc Get active customer session orders for a table (tenant-scoped)
// @route GET /api/public/orders/table/:adminId/:tableNumber/active
exports.getActiveOrdersForTableByAdmin = async (req, res, next) => {
  try {
    const { adminId, tableNumber } = req.params;
    const { customerMobile } = req.query;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const filter = {
      adminId,
      tableNumber,
      createdAt: { $gte: todayStart }
    };

    if (customerMobile && /^\d{10}$/.test(String(customerMobile).trim())) {
      filter.customerMobile = String(customerMobile).trim();
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    const sessionTotal = orders.reduce((sum, ord) => sum + (ord.grandTotal || 0), 0);

    res.json({
      success: true,
      tableNumber,
      adminId,
      count: orders.length,
      sessionTotal,
      orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc Legacy active orders route
// @route GET /api/public/orders/table/:tableNumber/active
exports.getActiveOrdersForTable = async (req, res, next) => {
  try {
    const { tableNumber } = req.params;
    const { customerMobile, adminId } = req.query;

    if (adminId) {
      req.params.adminId = adminId;
      req.params.tableNumber = tableNumber;
      return exports.getActiveOrdersForTableByAdmin(req, res, next);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const filter = {
      tableNumber,
      createdAt: { $gte: todayStart }
    };

    if (customerMobile && /^\d{10}$/.test(String(customerMobile).trim())) {
      filter.customerMobile = String(customerMobile).trim();
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    const sessionTotal = orders.reduce((sum, ord) => sum + (ord.grandTotal || 0), 0);

    res.json({
      success: true,
      tableNumber,
      count: orders.length,
      sessionTotal,
      orders
    });
  } catch (error) {
    next(error);
  }
};

exports.getTableSessionOrders = exports.getActiveOrdersForTable;

// @desc Get public order status by orderNumber
// @route GET /api/public/orders/:orderNumber/status
exports.getOrderStatus = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber }).populate('table');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const setting = await Setting.findOne({ adminId: order.adminId }) || {};

    res.json({
      success: true,
      order,
      setting
    });
  } catch (error) {
    next(error);
  }
};

exports.getPublicOrderStatus = exports.getOrderStatus;

// @desc Public bill PDF URL for WhatsApp / share links
// @route GET /api/public/orders/:orderNumber/bill-link
exports.getOrderBillLink = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const setting = await Setting.findOne({ adminId: order.adminId }) || {};

    res.json({
      success: true,
      billUrl: getPublicBillPdfUrl(orderNumber, req),
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      restaurantName: setting.restaurantName || 'Royal Spice Restaurant',
      contactNumber: setting.mobile || '',
      address: setting.address || '',
      gstNumber: setting.gstNumber || ''
    });
  } catch (error) {
    next(error);
  }
};

// @desc Download order bill as PDF (paid orders only)
// @route GET /api/public/orders/:orderNumber/bill.pdf
exports.getOrderBillPdf = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus !== 'Paid') {
      return res.status(400).json({ success: false, message: 'Bill is available only for paid orders' });
    }

    const setting = await Setting.findOne({ adminId: order.adminId }) || {};
    const pdfBuffer = await generateOrderBillPdfBuffer(order, {
      restaurantName: setting.restaurantName || 'Royal Spice Restaurant',
      taxLabel: `GST Tax (${setting.taxPercentage || 5}%)`,
      contactNumber: setting.mobile || '',
      address: setting.address || '',
      gstNumber: setting.gstNumber || ''
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Bill-${order.orderNumber}.pdf"`,
      'Cache-Control': 'public, max-age=300'
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// @desc Submit Customer 5-Star Rating & Review
// @route POST /api/public/orders/:orderNumber/rate
exports.submitOrderRating = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
    }

    let order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.rating = rating;
    order.review = review || '';
    await order.save();

    emitOrderRating(order);

    res.json({
      success: true,
      message: 'Thank you for your rating!',
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.rateOrder = exports.submitOrderRating;
