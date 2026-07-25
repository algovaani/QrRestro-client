const Inventory = require('../models/Inventory');
const Branch = require('../models/Branch');
const {
  getTenantAdminId,
  assertTenantOwnership
} = require('../middleware/tenantMiddleware');
const {
  getStockStatus,
  serializeInventoryRow
} = require('../utils/inventoryUtils');

const assertBranchOwnership = async (branchId, adminId, res) => {
  const branch = await Branch.findOne({ _id: branchId, adminId });
  if (!branch) {
    if (res) {
      res.status(404).json({ success: false, message: 'Branch not found' });
    }
    return null;
  }
  return branch;
};

const loadInventoryRows = async (adminId, branchFilter = null) => {
  const query = {
    adminId,
    // Kitchen stock only — not menu dishes
    customItemName: { $exists: true, $nin: [null, ''] },
    $or: [{ menuItemId: null }, { menuItemId: { $exists: false } }]
  };
  if (branchFilter) query.branchId = branchFilter;

  const rows = await Inventory.find(query).sort({ updatedAt: -1 });
  const branchIds = [...new Set(rows.map((r) => String(r.branchId)))];
  const branches = await Branch.find({ _id: { $in: branchIds } }).select('branchName').lean();
  const branchMap = Object.fromEntries(branches.map((b) => [String(b._id), b]));

  return rows.map((row) =>
    serializeInventoryRow(row, null, branchMap[String(row.branchId)])
  );
};

exports.getInventory = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const branchId = req.query.branchId;
    const status = req.query.status;
    const branchFilter = branchId && branchId !== 'all' ? branchId : null;

    let items = await loadInventoryRows(adminId, branchFilter);

    if (status && status !== 'all') {
      items = items.filter((item) => item.stockStatus === status);
    }

    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) {
      items = items.filter(
        (item) =>
          item.itemName.toLowerCase().includes(search) ||
          item.branchName.toLowerCase().includes(search)
      );
    }

    const summary = {
      total: items.length,
      in_stock: items.filter((i) => i.stockStatus === 'in_stock').length,
      low_stock: items.filter((i) => i.stockStatus === 'low_stock').length,
      out_of_stock: items.filter((i) => i.stockStatus === 'out_of_stock').length
    };

    res.json({ success: true, count: items.length, summary, items });
  } catch (error) {
    next(error);
  }
};

exports.upsertInventory = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const { branchId, customItemName, itemName, quantity, lowStockThreshold, unit, isTracked } = req.body;
    const cleanName = String(customItemName || itemName || '').trim();

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Item name required (e.g. Salt, Mirch, Ghee, Haldi)'
      });
    }

    const branch = await assertBranchOwnership(branchId, adminId, res);
    if (!branch) return;

    const qty = Math.max(0, Number(quantity) || 0);
    const threshold = Math.max(0, Number(lowStockThreshold) ?? 5);

    let record = await Inventory.findOne({
      adminId,
      branchId,
      customItemName: cleanName,
      $or: [{ menuItemId: null }, { menuItemId: { $exists: false } }]
    });

    if (record) {
      const prevQty = record.quantity || 0;
      record.quantity = qty;
      record.lowStockThreshold = threshold;
      record.menuItemId = null;
      if (unit !== undefined) record.unit = String(unit).trim() || 'kg';
      if (isTracked !== undefined) record.isTracked = Boolean(isTracked);
      if (qty > prevQty) record.lastRestockedAt = new Date();
      await record.save();
    } else {
      record = await Inventory.create({
        adminId,
        branchId,
        menuItemId: null,
        customItemName: cleanName,
        quantity: qty,
        lowStockThreshold: threshold,
        unit: unit ? String(unit).trim() : 'kg',
        isTracked: isTracked !== false,
        lastRestockedAt: qty > 0 ? new Date() : null
      });
    }

    res.json({
      success: true,
      item: serializeInventoryRow(record, null, branch)
    });
  } catch (error) {
    next(error);
  }
};

exports.adjustInventory = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const record = await Inventory.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }
    if (!assertTenantOwnership(record, req.user, res, 'Not authorized')) return;

    const adjustment = Number(req.body.adjustment);
    if (!Number.isFinite(adjustment) || adjustment === 0) {
      return res.status(400).json({ success: false, message: 'Valid adjustment amount is required' });
    }

    const prevQty = record.quantity || 0;
    record.quantity = Math.max(0, prevQty + adjustment);
    if (adjustment > 0) record.lastRestockedAt = new Date();
    await record.save();

    const branch = await Branch.findById(record.branchId).select('branchName').lean();

    res.json({
      success: true,
      item: serializeInventoryRow(record, null, branch)
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteInventory = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const record = await Inventory.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }
    if (!assertTenantOwnership(record, req.user, res, 'Not authorized')) return;

    await record.deleteOne();
    res.json({ success: true, message: 'Stock item removed' });
  } catch (error) {
    next(error);
  }
};

exports.getInventorySummary = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const items = await loadInventoryRows(adminId, null);
    const byBranch = {};

    for (const item of items) {
      const key = item.branchId || 'unknown';
      if (!byBranch[key]) {
        byBranch[key] = {
          branchId: item.branchId,
          branchName: item.branchName,
          total: 0,
          in_stock: 0,
          low_stock: 0,
          out_of_stock: 0
        };
      }
      byBranch[key].total += 1;
      byBranch[key][item.stockStatus] += 1;
    }

    res.json({
      success: true,
      overall: {
        total: items.length,
        in_stock: items.filter((i) => i.stockStatus === 'in_stock').length,
        low_stock: items.filter((i) => i.stockStatus === 'low_stock').length,
        out_of_stock: items.filter((i) => i.stockStatus === 'out_of_stock').length
      },
      branches: Object.values(byBranch)
    });
  } catch (error) {
    next(error);
  }
};
