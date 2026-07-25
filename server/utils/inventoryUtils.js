const Inventory = require('../models/Inventory');

exports.getStockStatus = (quantity, lowStockThreshold = 5) => {
  const qty = Number(quantity) || 0;
  const threshold = Number(lowStockThreshold) || 0;
  if (qty <= 0) return 'out_of_stock';
  if (qty <= threshold) return 'low_stock';
  return 'in_stock';
};

exports.serializeInventoryRow = (row, _menuItem, branch) => {
  const quantity = row.quantity ?? 0;
  const lowStockThreshold = row.lowStockThreshold ?? 5;
  const itemName = row.customItemName || 'Unknown Item';
  return {
    _id: row._id,
    adminId: row.adminId,
    branchId: row.branchId,
    branchName: branch?.branchName || '',
    menuItemId: null,
    customItemName: row.customItemName || '',
    isCustom: true,
    itemName,
    categoryName: 'Kitchen Stock',
    foodType: '',
    image: '',
    quantity,
    lowStockThreshold,
    unit: row.unit || 'kg',
    isTracked: row.isTracked !== false,
    stockStatus: exports.getStockStatus(quantity, lowStockThreshold),
    lastRestockedAt: row.lastRestockedAt,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt
  };
};

/**
 * Kitchen inventory (salt, oil, etc.) is not linked to menu orders.
 * Kept as a no-op so order placement does not touch stock.
 */
exports.deductInventoryForOrder = async () => {};
