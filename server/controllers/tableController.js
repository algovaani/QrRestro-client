const Table = require('../models/Table');
const Branch = require('../models/Branch');
const QRCode = require('qrcode');
const { getTenantAdminId, buildScopedFilter, assertTenantOwnership } = require('../middleware/tenantMiddleware');
const { buildMenuQrUrl } = require('../utils/tenantUtils');
const { ensureDefaultBranch } = require('../utils/branchUtils');
const { getClientUrl } = require('../utils/clientUrl');

const buildQrForTable = async (table) => {
  const qrDataUrl = buildMenuQrUrl(getClientUrl(), table.adminId, table.branchId, table.tableNumber);
  const qrCodeImage = await QRCode.toDataURL(qrDataUrl, { errorCorrectionLevel: 'H', margin: 2, width: 300 });
  return { qrDataUrl, qrCodeImage };
};

// @desc Get all tables (filtered by admin + optional branch)
// @route GET /api/tables
exports.getTables = async (req, res, next) => {
  try {
    const filter = buildScopedFilter(req.user, req, res);
    if (!filter) return;

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
    if (!assertTenantOwnership(table, req.user, res, 'Not authorized to view this table')) return;
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
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }

    const { tableName, tableNumber, capacity, section, branchId: bodyBranchId } = req.body;

    let branchId = bodyBranchId;
    if (!branchId) {
      const defaultBranch = await ensureDefaultBranch(adminId);
      branchId = defaultBranch?._id;
    }

    const branch = await Branch.findOne({ _id: branchId, adminId });
    if (!branch) {
      return res.status(400).json({ success: false, message: 'Invalid branch selected' });
    }

    const existingTable = await Table.findOne({ adminId, branchId, tableNumber });
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: `Table Number ${tableNumber} already exists in ${branch.branchName}.`
      });
    }

    const draft = {
      adminId,
      branchId,
      tableName,
      tableNumber,
      capacity: capacity || 4,
      section: section || 'Main Hall',
      status: 'Active'
    };

    const { qrDataUrl, qrCodeImage } = await buildQrForTable(draft);

    const table = await Table.create({
      ...draft,
      qrCodeImage,
      qrUrl: qrDataUrl
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
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }
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
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }
    if (adminId && table.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!table.branchId) {
      const defaultBranch = await ensureDefaultBranch(adminId);
      table.branchId = defaultBranch._id;
    }

    const { qrDataUrl, qrCodeImage } = await buildQrForTable(table);

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
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }
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
