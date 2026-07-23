const Branch = require('../models/Branch');
const Table = require('../models/Table');
const Order = require('../models/Order');

const ensureDefaultBranch = async (adminId, hintName = 'Main Branch') => {
  if (!adminId) return null;

  let branch = await Branch.findOne({ adminId, isDefault: true });
  if (!branch) {
    branch = await Branch.findOne({ adminId }).sort({ createdAt: 1 });
  }
  if (!branch) {
    branch = await Branch.create({
      adminId,
      branchName: hintName,
      isDefault: true,
      isActive: true
    });
  } else if (!branch.isDefault) {
    const hasDefault = await Branch.exists({ adminId, isDefault: true });
    if (!hasDefault) {
      branch.isDefault = true;
      await branch.save();
    }
  }
  return branch;
};

const migrateBranchesForTenant = async (adminId) => {
  const branch = await ensureDefaultBranch(adminId);
  if (!branch) return { branchId: null, tables: 0, orders: 0 };

  const branchId = branch._id;

  const tableResult = await Table.updateMany(
    { adminId, $or: [{ branchId: { $exists: false } }, { branchId: null }] },
    { $set: { branchId } }
  );

  const orderResult = await Order.updateMany(
    { adminId, $or: [{ branchId: { $exists: false } }, { branchId: null }] },
    { $set: { branchId, branchName: branch.branchName } }
  );

  return {
    branchId,
    tables: tableResult.modifiedCount || 0,
    orders: orderResult.modifiedCount || 0
  };
};

const migrateAllBranches = async ({ log = false } = {}) => {
  const User = require('../models/User');
  const admins = await User.find({ role: 'Admin' }).select('_id restaurantName');
  let totalTables = 0;
  let totalOrders = 0;

  for (const admin of admins) {
    const result = await migrateBranchesForTenant(admin._id);
    totalTables += result.tables;
    totalOrders += result.orders;
    if (log && result.tables + result.orders > 0) {
      console.log(`[branches] migrated admin ${admin._id}: tables=${result.tables}, orders=${result.orders}`);
    }
  }

  if (log) {
    console.log(`[branches] migration done — tables=${totalTables}, orders=${totalOrders}`);
  }

  return { totalTables, totalOrders };
};

module.exports = {
  ensureDefaultBranch,
  migrateBranchesForTenant,
  migrateAllBranches
};
