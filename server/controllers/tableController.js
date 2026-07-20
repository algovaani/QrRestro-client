const Table = require('../models/Table');
const QRCode = require('qrcode');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');
const { buildMenuQrUrl } = require('../utils/tenantUtils');

const { getClientUrl } = require('../utils/clientUrl');

// @desc Get all tables (filtered strictly by logged-in adminId)
// @route GET /api/tables
exports.getTables = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    const filter = adminId ? { adminId } : {};

    const tables = await Table.find(filter).sort({ tableNumber: 1 });
    res.json({
      success: true,
      count: tables.length,
      tables
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single table by ID
// @route GET /api/tables/:id
exports.getTableById = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    res.json({
      success: true,
      table
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create table with QR Code for logged-in admin
// @route POST /api/tables
exports.createTable = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    const { tableName, tableNumber, capacity, section } = req.body;

    const existingTable = await Table.findOne({ adminId, tableNumber });
    if (existingTable) {
      return res.status(400).json({ success: false, message: `Table Number ${tableNumber} already exists for your restaurant.` });
    }

    const qrDataUrl = buildMenuQrUrl(getClientUrl(), adminId, tableNumber);
    const qrCodeImage = await QRCode.toDataURL(qrDataUrl, { errorCorrectionLevel: 'H', margin: 2, width: 300 });

    const table = await Table.create({
      adminId,
      tableName,
      tableNumber,
      capacity: capacity || 4,
      section: section || 'Main Hall',
      qrCodeImage,
      qrUrl: qrDataUrl,
      status: 'Active'
    });

    res.status(201).json({
      success: true,
      table
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update table
// @route PUT /api/tables/:id
exports.updateTable = async (req, res, next) => {
  try {
    let table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && table.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify another restaurant table' });
    }

    const { tableName, capacity, section, status } = req.body;

    if (tableName) table.tableName = tableName;
    if (capacity) table.capacity = capacity;
    if (section) table.section = section;
    if (status) table.status = status;

    await table.save();

    res.json({
      success: true,
      table
    });
  } catch (error) {
    next(error);
  }
};

// @desc Regenerate Table QR Code
// @route POST /api/tables/:id/regenerate-qr
exports.regenerateQR = async (req, res, next) => {
  try {
    let table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && table.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const qrDataUrl = buildMenuQrUrl(getClientUrl(), table.adminId, table.tableNumber);
    const qrCodeImage = await QRCode.toDataURL(qrDataUrl, { errorCorrectionLevel: 'H', margin: 2, width: 300 });

    table.qrCodeImage = qrCodeImage;
    table.qrUrl = qrDataUrl;
    await table.save();

    res.json({
      success: true,
      message: 'QR Code regenerated successfully',
      table
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete table
// @route DELETE /api/tables/:id
exports.deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && table.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete another restaurant table' });
    }

    await table.deleteOne();

    res.json({
      success: true,
      message: 'Table deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
