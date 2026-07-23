const Inventory = require('../models/Inventory');
const MenuItem = require('../models/MenuItem');
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
  const query = { adminId };
  if (branchFilter) query.branchId = branchFilter;

  const rows = await Inventory.find(query).sort({ updatedAt: -1 });
  const menuItemIds = [...new Set(rows.map((r) => r.menuItemId).filter(Boolean).map(String))];
  const branchIds = [...new Set(rows.map((r) => String(r.branchId)))];

  const [menuItems, branches] = await Promise.all([
    MenuItem.find({ _id: { $in: menuItemIds } }).populate('category', 'name').lean(),
    Branch.find({ _id: { $in: branchIds } }).select('branchName').lean()
  ]);

  const menuMap = Object.fromEntries(menuItems.map((m) => [String(m._id), m]));
  const branchMap = Object.fromEntries(branches.map((b) => [String(b._id), b]));

  return rows.map((row) =>
    serializeInventoryRow(row, menuMap[String(row.menuItemId)], branchMap[String(row.branchId)])
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
          item.categoryName.toLowerCase().includes(search) ||
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

exports.getUntrackedMenuItems = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const { branchId } = req.query;
    if (!branchId || branchId === 'all') {
      return res.status(400).json({ success: false, message: 'Select a branch first' });
    }

    const branch = await assertBranchOwnership(branchId, adminId, res);
    if (!branch) return;

    const [menuItems, existing] = await Promise.all([
      MenuItem.find({ adminId, status: 'Active' }).populate('category', 'name').sort({ name: 1 }).lean(),
      Inventory.find({ adminId, branchId }).lean()
    ]);

    const invByMenuId = Object.fromEntries(
      existing.filter((e) => e.menuItemId).map((e) => [String(e.menuItemId), e])
    );

    const items = menuItems.map((m) => {
      const inv = invByMenuId[String(m._id)];
      return {
        _id: m._id,
        name: m.name,
        categoryName: m.category?.name || '',
        foodType: m.foodType,
        alreadyTracked: Boolean(inv),
        currentQuantity: inv?.quantity ?? null,
        inventoryId: inv?._id || null
      };
    });

    res.json({
      success: true,
      count: items.length,
      items,
      hasMenuItems: items.length > 0
    });
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

    const { branchId, menuItemId, customItemName, quantity, lowStockThreshold, unit, isTracked } = req.body;
    const cleanCustomName = String(customItemName || '').trim();

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }
    if (!menuItemId && !cleanCustomName) {
      return res.status(400).json({ success: false, message: 'Menu item ya custom item name required hai' });
    }
    if (menuItemId && cleanCustomName) {
      return res.status(400).json({ success: false, message: 'Sirf menu item YA custom name — dono nahi' });
    }

    const branch = await assertBranchOwnership(branchId, adminId, res);
    if (!branch) return;

    let menuItem = null;
    if (menuItemId) {
      menuItem = await MenuItem.findOne({ _id: menuItemId, adminId });
      if (!menuItem) {
        return res.status(404).json({ success: false, message: 'Menu item not found' });
      }
    }

    const qty = Math.max(0, Number(quantity) || 0);
    const threshold = Math.max(0, Number(lowStockThreshold) ?? 10);

    let record;
    if (menuItemId) {
      record = await Inventory.findOne({ adminId, branchId, menuItemId });
    } else {
      record = await Inventory.findOne({
        adminId,
        branchId,
        customItemName: cleanCustomName,
        menuItemId: null
      });
    }

    if (record) {
      const prevQty = record.quantity || 0;
      record.quantity = qty;
      record.lowStockThreshold = threshold;
      if (unit !== undefined) record.unit = String(unit).trim() || 'pcs';
      if (isTracked !== undefined) record.isTracked = Boolean(isTracked);
      if (qty > prevQty) record.lastRestockedAt = new Date();
      await record.save();
    } else {
      record = await Inventory.create({
        adminId,
        branchId,
        menuItemId: menuItemId || null,
        customItemName: menuItemId ? '' : cleanCustomName,
        quantity: qty,
        lowStockThreshold: threshold,
        unit: unit ? String(unit).trim() : 'pcs',
        isTracked: isTracked !== false,
        lastRestockedAt: qty > 0 ? new Date() : null
      });
    }

    let populatedMenu = null;
    if (menuItemId) {
      populatedMenu = await MenuItem.findById(menuItemId).populate('category', 'name').lean();
    }

    res.json({
      success: true,
      item: serializeInventoryRow(record, populatedMenu, branch)
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

    const [menuItem, branch] = await Promise.all([
      MenuItem.findById(record.menuItemId).populate('category', 'name').lean(),
      Branch.findById(record.branchId).select('branchName').lean()
    ]);

    res.json({
      success: true,
      item: serializeInventoryRow(record, menuItem, branch)
    });
  } catch (error) {
    next(error);
  }
};

exports.initBranchInventory = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const { branchId, defaultQuantity = 0, lowStockThreshold = 10 } = req.body;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    const branch = await assertBranchOwnership(branchId, adminId, res);
    if (!branch) return;

    const menuItems = await MenuItem.find({ adminId, status: 'Active' }).select('_id');
    const existing = await Inventory.find({ adminId, branchId }).select('menuItemId');
    const existingIds = new Set(existing.map((e) => String(e.menuItemId)));

    const toCreate = menuItems
      .filter((m) => !existingIds.has(String(m._id)))
      .map((m) => ({
        adminId,
        branchId,
        menuItemId: m._id,
        quantity: Math.max(0, Number(defaultQuantity) || 0),
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 10),
        unit: 'pcs',
        isTracked: true,
        lastRestockedAt: Number(defaultQuantity) > 0 ? new Date() : null
      }));

    if (toCreate.length > 0) {
      await Inventory.insertMany(toCreate, { ordered: false });
    }

    res.json({
      success: true,
      message: `${toCreate.length} menu item(s) added to inventory for ${branch.branchName}`,
      addedCount: toCreate.length
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
    res.json({ success: true, message: 'Inventory tracking removed for this item' });
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
