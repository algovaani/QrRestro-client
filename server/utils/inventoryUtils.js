const Inventory = require('../models/Inventory');

exports.getStockStatus = (quantity, lowStockThreshold = 10) => {
  const qty = Number(quantity) || 0;
  const threshold = Number(lowStockThreshold) || 0;
  if (qty <= 0) return 'out_of_stock';
  if (qty <= threshold) return 'low_stock';
  return 'in_stock';
};

exports.serializeInventoryRow = (row, menuItem, branch) => {
  const quantity = row.quantity ?? 0;
  const lowStockThreshold = row.lowStockThreshold ?? 10;
  const isCustom = !row.menuItemId && Boolean(row.customItemName);
  return {
    _id: row._id,
    adminId: row.adminId,
    branchId: row.branchId,
    branchName: branch?.branchName || '',
    menuItemId: row.menuItemId || null,
    customItemName: row.customItemName || '',
    isCustom,
    itemName: menuItem?.name || row.customItemName || 'Unknown Item',
    categoryName: menuItem?.category?.name || (isCustom ? 'Custom Stock' : ''),
    foodType: menuItem?.foodType || '',
    image: menuItem?.image || '',
    quantity,
    lowStockThreshold,
    unit: row.unit || 'pcs',
    isTracked: row.isTracked !== false,
    stockStatus: exports.getStockStatus(quantity, lowStockThreshold),
    lastRestockedAt: row.lastRestockedAt,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt
  };
};

/** Deduct stock when customer places order (only tracked inventory rows). */
exports.deductInventoryForOrder = async (adminId, branchId, orderItems = []) => {
  if (!adminId || !branchId || !orderItems.length) return;

  for (const item of orderItems) {
    const menuItemId = item.menuItem || item.menuItemId;
    if (!menuItemId) continue;

    const qty = Number(item.quantity) || 1;
    const record = await Inventory.findOne({
      adminId,
      branchId,
      menuItemId,
      isTracked: { $ne: false }
    });

    if (!record) continue;

    record.quantity = Math.max(0, (record.quantity || 0) - qty);
    await record.save();
  }
};
