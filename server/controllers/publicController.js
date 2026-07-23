const Table = require('../models/Table');
const Branch = require('../models/Branch');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const { emitNewOrder, emitOrderRating } = require('../socket/socketHandler');
const { generateOrderBillPdfBuffer } = require('../utils/billPdf');
const { getPublicBillPdfUrl, orderBillIsAvailable } = require('../utils/publicApiUrl');
const { MAX_REVIEW_WORDS, countReviewWords, sanitizeReviewForSave } = require('../utils/reviewText');
const { normalizeMenuItemImage, ensureMenuItemImageStored, getMenuItemPhotoPath } = require('../utils/menuImage');
const { ensureDefaultBranch } = require('../utils/branchUtils');
const { deductInventoryForOrder } = require('../utils/inventoryUtils');

const generateOrderNumber = () => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${randomNum}`;
};

const resolveBranchForLegacyTable = async (adminId, tables) => {
  if (!tables.length) return null;
  if (tables.length === 1) return tables[0];

  const defaultBranch = await Branch.findOne({ adminId, isDefault: true });
  if (defaultBranch) {
    const match = tables.find((t) => String(t.branchId) === String(defaultBranch._id));
    if (match) return match;
  }

  const error = new Error('Multiple branches use this table number. Please scan the updated QR code from your table.');
  error.status = 409;
  throw error;
};

const findActiveTable = async (tableNumber, adminId, branchId) => {
  const tNum = String(tableNumber);

  if (adminId && branchId) {
    return Table.findOne({ adminId, branchId, tableNumber: tNum, status: 'Active' });
  }

  if (adminId) {
    const tables = await Table.find({ adminId, tableNumber: tNum, status: 'Active' });
    if (tables.length === 0) return null;
    return resolveBranchForLegacyTable(adminId, tables);
  }

  const tables = await Table.find({ tableNumber: tNum, status: 'Active' });
  if (tables.length === 0) return null;
  if (tables.length > 1) {
    const error = new Error('Multiple restaurants use this table number. Please scan the QR code placed on your table.');
    error.status = 409;
    throw error;
  }
  return tables[0];
};

const findTableForOrder = async (tableNumber, adminId, branchId) => {
  const tNum = String(tableNumber);

  if (adminId && branchId) {
    return Table.findOne({ adminId, branchId, tableNumber: tNum });
  }

  if (adminId) {
    const tables = await Table.find({ adminId, tableNumber: tNum });
    if (tables.length === 0) return null;
    return resolveBranchForLegacyTable(adminId, tables);
  }

  const tables = await Table.find({ tableNumber: tNum });
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
  let branch = null;
  if (table.branchId) {
    branch = await Branch.findById(table.branchId).select('branchName address city mobile isActive');
  }

  const categories = await Category.find({ adminId, status: 'Active' }).sort({ displayOrder: 1 });
  const menuItems = await MenuItem.find({ adminId, status: 'Active', isAvailable: true })
    .select('+imageData')
    .populate('category');

  await Promise.all(
    menuItems.map(async (item) => {
      if (
        item.imageData ||
        item.image?.startsWith('/uploads/') ||
        item.image?.startsWith('data:')
      ) {
        await ensureMenuItemImageStored(item);
      } else if (item.imageData && !String(item.image || '').includes('/photo')) {
        item.image = getMenuItemPhotoPath(item._id);
        await item.save();
      }
    })
  );

  return {
    success: true,
    table,
    tableNumber: table.tableNumber,
    adminId,
    branchId: table.branchId || null,
    branchName: branch?.branchName || '',
    branch,
    categories,
    menuItems: menuItems.map(normalizeMenuItemImage),
    setting: await Setting.findOne({ adminId }) || {}
  };
};

// @desc Get table info & public menu (tenant-scoped, legacy — no branch in URL)
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

// @desc Get table info & public menu (branch-scoped QR)
// @route GET /api/public/menu/:adminId/branch/:branchId/table/:tableNumber
exports.getPublicMenuByAdminBranch = async (req, res, next) => {
  try {
    const { adminId, branchId, tableNumber } = req.params;
    const table = await findActiveTable(tableNumber, adminId, branchId);
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
    const { tableNumber, adminId, branchId, customerName, customerMobile, items, notes, paymentMethod } = req.body;

    if (!customerMobile || !/^\d{10}$/.test(customerMobile.trim())) {
      return res.status(400).json({ success: false, message: 'A valid 10-digit Customer Mobile Number is required.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order cart cannot be empty' });
    }

    const table = await findTableForOrder(tableNumber, adminId, branchId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Invalid table number' });
    }

    const tenantAdminId = table.adminId;
    const setting = await Setting.findOne({ adminId: tenantAdminId }) || { taxPercentage: 5 };

    let branch = null;
    if (table.branchId) {
      branch = await Branch.findById(table.branchId);
    }
    if (!branch) {
      branch = await ensureDefaultBranch(tenantAdminId);
    }

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

    const resolvedTableNumber = String(table.tableNumber);

    const order = await Order.create({
      adminId: tenantAdminId,
      branchId: branch?._id || table.branchId,
      branchName: branch?.branchName || '',
      orderNumber,
      tableNumber: resolvedTableNumber,
      table: table._id,
      customerName: (customerName && customerName.trim()) ? customerName.trim() : 'Guest',
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

    try {
      await deductInventoryForOrder(tenantAdminId, branch?._id || table.branchId, processedItems);
    } catch (e) {
      console.error('Inventory deduct error:', e);
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

const buildActiveOrdersFilter = (adminId, tableNumber, branchId, customerMobile) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const filter = {
    adminId,
    tableNumber: String(tableNumber),
    createdAt: { $gte: todayStart }
  };

  if (branchId) {
    filter.branchId = branchId;
  }

  if (customerMobile && /^\d{10}$/.test(String(customerMobile).trim())) {
    filter.customerMobile = String(customerMobile).trim();
  }

  return filter;
};

// @desc Get active customer session orders for a table (tenant-scoped)
// @route GET /api/public/orders/table/:adminId/:tableNumber/active
exports.getActiveOrdersForTableByAdmin = async (req, res, next) => {
  try {
    const { adminId, tableNumber } = req.params;
    const { customerMobile, branchId } = req.query;

    const filter = buildActiveOrdersFilter(adminId, tableNumber, branchId, customerMobile);

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    const sessionTotal = orders.reduce((sum, ord) => sum + (ord.grandTotal || 0), 0);

    res.json({
      success: true,
      tableNumber,
      adminId,
      branchId: branchId || null,
      count: orders.length,
      sessionTotal,
      orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get active orders (branch-scoped)
// @route GET /api/public/orders/table/:adminId/branch/:branchId/:tableNumber/active
exports.getActiveOrdersForTableByAdminBranch = async (req, res, next) => {
  try {
    const { adminId, branchId, tableNumber } = req.params;
    const { customerMobile } = req.query;

    const filter = buildActiveOrdersFilter(adminId, tableNumber, branchId, customerMobile);

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    const sessionTotal = orders.reduce((sum, ord) => sum + (ord.grandTotal || 0), 0);

    res.json({
      success: true,
      tableNumber,
      adminId,
      branchId,
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
    const { customerMobile, adminId, branchId } = req.query;

    if (adminId && branchId) {
      req.params.adminId = adminId;
      req.params.branchId = branchId;
      req.params.tableNumber = tableNumber;
      return exports.getActiveOrdersForTableByAdminBranch(req, res, next);
    }

    if (adminId) {
      req.params.adminId = adminId;
      req.params.tableNumber = tableNumber;
      return exports.getActiveOrdersForTableByAdmin(req, res, next);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const filter = {
      tableNumber: String(tableNumber),
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

    if (!orderBillIsAvailable(order)) {
      return res.status(400).json({
        success: false,
        message: 'Bill is available only after payment is confirmed',
        paymentStatus: order.paymentStatus
      });
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

    if (review && countReviewWords(review) > MAX_REVIEW_WORDS) {
      return res.status(400).json({
        success: false,
        message: `Review must be ${MAX_REVIEW_WORDS} words or less`
      });
    }

    order.rating = rating;
    order.review = sanitizeReviewForSave(review || '');
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
