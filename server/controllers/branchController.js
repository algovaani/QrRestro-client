const Branch = require('../models/Branch');
const Table = require('../models/Table');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const { getTenantAdminId, assertTenantOwnership } = require('../middleware/tenantMiddleware');
const { ensureDefaultBranch } = require('../utils/branchUtils');
const { canCreateBranch, getMaxBranchesForAdmin, enforceBranchLimitForAdmin, isBranchOperational } = require('../utils/branchLimits');
const { resolveBranchFeatures, normalizeFeatureKeys, resolveAdminFeatureKeys } = require('../utils/planFeatures');

exports.getBranches = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    await ensureDefaultBranch(adminId);
    await enforceBranchLimitForAdmin(adminId);

    let branches;
    if (req.user.role === 'BranchAdmin') {
      const branch = await Branch.findOne({ _id: req.user.branchId, adminId });
      if (!branch) {
        return res.json({ success: true, count: 0, branches: [], totals: null });
      }
      branches = [branch];
    } else {
      branches = await Branch.find({ adminId }).sort({ isDefault: -1, branchName: 1 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [tableCounts, orderStats, managers] = await Promise.all([
      Table.aggregate([
        { $match: { adminId } },
        { $group: { _id: '$branchId', tableCount: { $sum: 1 }, activeTables: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } } } }
      ]),
      Order.aggregate([
        {
          $match: {
            adminId,
            createdAt: { $gte: todayStart },
            orderStatus: { $ne: 'Cancelled' }
          }
        },
        {
          $group: {
            _id: '$branchId',
            todayOrders: { $sum: 1 },
            todayRevenue: { $sum: '$grandTotal' },
            pendingOrders: {
              $sum: {
                $cond: [{ $in: ['$orderStatus', ['New', 'Confirmed', 'Preparing', 'Ready']] }, 1, 0]
              }
            }
          }
        }
      ]),
      User.find({ restaurantAdminId: adminId, role: 'BranchAdmin' }).select('name email branchId isActive')
    ]);

    const tableMap = Object.fromEntries(tableCounts.map((r) => [String(r._id), r]));
    const orderMap = Object.fromEntries(orderStats.map((r) => [String(r._id), r]));

    const parentFeatureSource = req.user.role === 'Admin'
      ? { planName: req.user.planName, extraFeatureKeys: req.user.extraFeatureKeys || [] }
      : await User.findById(adminId).select('planName extraFeatureKeys');
    const adminFeatureKeys = await resolveAdminFeatureKeys(
      parentFeatureSource?.planName,
      parentFeatureSource?.extraFeatureKeys || []
    );

    const branchesWithStats = await Promise.all(branches.map(async (branch) => {
      const bid = String(branch._id);
      const tables = tableMap[bid] || {};
      const orders = orderMap[bid] || {};
      const manager = managers.find((m) => String(m.branchId) === bid);
      const branchFeatures = await resolveBranchFeatures(branch, adminFeatureKeys);
      return {
        ...branch.toObject(),
        effectiveFeatureKeys: branchFeatures.featureKeys,
        effectiveFeatures: branchFeatures.features,
        stats: {
          tableCount: tables.tableCount || 0,
          activeTables: tables.activeTables || 0,
          todayOrders: orders.todayOrders || 0,
          todayRevenue: orders.todayRevenue || 0,
          pendingOrders: orders.pendingOrders || 0
        },
        branchManager: manager
          ? { _id: manager._id, name: manager.name, email: manager.email, isActive: manager.isActive }
          : null
      };
    }));

    const totals = branchesWithStats.reduce(
      (acc, b) => ({
        tableCount: acc.tableCount + (b.stats?.tableCount || 0),
        activeTables: acc.activeTables + (b.stats?.activeTables || 0),
        todayOrders: acc.todayOrders + (b.stats?.todayOrders || 0),
        todayRevenue: acc.todayRevenue + (b.stats?.todayRevenue || 0),
        pendingOrders: acc.pendingOrders + (b.stats?.pendingOrders || 0)
      }),
      { tableCount: 0, activeTables: 0, todayOrders: 0, todayRevenue: 0, pendingOrders: 0 }
    );

    res.json({
      success: true,
      count: branches.length,
      branches: branchesWithStats,
      totals,
      branchLimits: {
        maxBranches: await getMaxBranchesForAdmin(adminId),
        currentBranches: branches.length,
        activeWithinLimit: branchesWithStats.filter((b) => isBranchOperational(b)).length,
        suspendedByLimit: branchesWithStats.filter((b) => b.suspendedByLimit).length
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createBranch = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const { branchName, address, city, mobile, isActive } = req.body;
    const name = String(branchName || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Branch name is required' });
    }

    const exists = await Branch.findOne({ adminId, branchName: name });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A branch with this name already exists' });
    }

    const limitCheck = await canCreateBranch(adminId);
    if (!limitCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: `Branch limit reached. Your plan allows maximum ${limitCheck.maxBranches} branch(es). Contact Super Admin to increase the limit.`
      });
    }

    const count = await Branch.countDocuments({ adminId });
    const branch = await Branch.create({
      adminId,
      branchName: name,
      address: address || '',
      city: city || '',
      mobile: mobile || '',
      isActive: isActive !== false,
      isDefault: count === 0
    });

    res.status(201).json({ success: true, branch });
  } catch (error) {
    next(error);
  }
};

exports.updateBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized to update this branch')) return;

    const { branchName, address, city, mobile, isActive, isDefault } = req.body;

    if (branchName && String(branchName).trim()) {
      const name = String(branchName).trim();
      const duplicate = await Branch.findOne({
        adminId: branch.adminId,
        branchName: name,
        _id: { $ne: branch._id }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'A branch with this name already exists' });
      }
      branch.branchName = name;
    }

    if (address !== undefined) branch.address = address;
    if (city !== undefined) branch.city = city;
    if (mobile !== undefined) branch.mobile = mobile;
    if (isActive !== undefined) {
      const wantsActive = Boolean(isActive);
      if (wantsActive) {
        await enforceBranchLimitForAdmin(branch.adminId);
        const refreshed = await Branch.findById(branch._id);
        if (refreshed?.suspendedByLimit) {
          return res.status(400).json({
            success: false,
            message: 'This branch exceeds your plan limit and cannot be activated. Delete an extra branch or contact Super Admin to increase your limit.'
          });
        }
        branch.isActive = true;
      } else {
        branch.isActive = false;
      }
    }

    if (isDefault === true) {
      await Branch.updateMany({ adminId: branch.adminId }, { $set: { isDefault: false } });
      branch.isDefault = true;
    }

    await branch.save();

    if (req.body.branchName) {
      await Order.updateMany(
        { adminId: branch.adminId, branchId: branch._id },
        { $set: { branchName: branch.branchName } }
      );
    }

    res.json({ success: true, branch });
  } catch (error) {
    next(error);
  }
};

exports.deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized to delete this branch')) return;

    const branchCount = await Branch.countDocuments({ adminId: branch.adminId });
    if (branchCount <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the only branch. Create another branch first.' });
    }

    const activeOrders = await Order.countDocuments({
      adminId: branch.adminId,
      branchId: branch._id,
      orderStatus: { $nin: ['Completed', 'Cancelled'] }
    });
    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch — ${activeOrders} active order(s) still open`
      });
    }

    await Table.deleteMany({ adminId: branch.adminId, branchId: branch._id });
    await Category.deleteMany({ adminId: branch.adminId, branchId: branch._id });
    await MenuItem.deleteMany({ adminId: branch.adminId, branchId: branch._id });
    await require('../models/Inventory').deleteMany({ adminId: branch.adminId, branchId: branch._id });
    await User.deleteMany({ branchId: branch._id, role: 'BranchAdmin' });
    await branch.deleteOne();

    if (branch.isDefault) {
      const fallback = await Branch.findOne({ adminId: branch.adminId }).sort({ createdAt: 1 });
      if (fallback) {
        fallback.isDefault = true;
        await fallback.save();
      }
    }

    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getBranchManager = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized')) return;

    const manager = await User.findOne({ branchId: branch._id, role: 'BranchAdmin' }).select('-password');
    res.json({
      success: true,
      manager: manager
        ? { _id: manager._id, name: manager.name, email: manager.email, isActive: manager.isActive }
        : null
    });
  } catch (error) {
    next(error);
  }
};

exports.upsertBranchManager = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only restaurant admin can create branch login' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized')) return;

    const { name, email, password, isActive } = req.body;
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').toLowerCase().trim();

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const parent = await User.findById(adminId);
    let manager = await User.findOne({ branchId: branch._id, role: 'BranchAdmin' });

    if (!manager) {
      if (!password || String(password).length < 6) {
        return res.status(400).json({ success: false, message: 'Password is required (min 6 characters)' });
      }

      const emailTaken = await User.findOne({ email: cleanEmail });
      if (emailTaken) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }

      manager = await User.create({
        name: cleanName,
        email: cleanEmail,
        password,
        role: 'BranchAdmin',
        restaurantAdminId: adminId,
        branchId: branch._id,
        restaurantName: parent?.restaurantName || branch.branchName,
        isActive: isActive !== false
      });
    } else {
      if (cleanEmail !== manager.email) {
        const emailTaken = await User.findOne({ email: cleanEmail, _id: { $ne: manager._id } });
        if (emailTaken) {
          return res.status(400).json({ success: false, message: 'Email already in use' });
        }
        manager.email = cleanEmail;
      }
      manager.name = cleanName;
      if (password && String(password).length >= 6) {
        manager.password = password;
      }
      if (isActive !== undefined) manager.isActive = Boolean(isActive);
      await manager.save();
    }

    res.json({
      success: true,
      manager: {
        _id: manager._id,
        name: manager.name,
        email: manager.email,
        isActive: manager.isActive
      },
      loginUrl: '/admin/login'
    });
  } catch (error) {
    next(error);
  }
};

exports.updateBranchFeatures = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only restaurant admin can assign branch features' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized')) return;

    const allowedKeys = await resolveAdminFeatureKeys(req.user.planName, req.user.extraFeatureKeys || []);
    const requestedKeys = await normalizeFeatureKeys(req.body.featureKeys || []);
    const allowedSet = new Set(allowedKeys);

    branch.featureKeys = requestedKeys.filter((key) => allowedSet.has(key));
    await branch.save();

    const resolved = await resolveBranchFeatures(branch, planFeatures.featureKeys);
    res.json({
      success: true,
      message: 'Branch features updated successfully',
      branch: {
        ...branch.toObject(),
        effectiveFeatureKeys: resolved.featureKeys,
        effectiveFeatures: resolved.features
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteBranchManager = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only restaurant admin can remove branch login' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized')) return;

    await User.deleteOne({ branchId: branch._id, role: 'BranchAdmin' });
    res.json({ success: true, message: 'Branch login removed' });
  } catch (error) {
    next(error);
  }
};

/** Restaurant admin opens branch portal as that branch manager (one-click) */
exports.portalLoginAsBranch = async (req, res, next) => {
  try {
    const { generateToken, serializeAuthUser, validateBranchAdminLogin } = require('./authController');

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only restaurant admin can open branch portal' });
    }

    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }
    if (!assertTenantOwnership(branch, req.user, res, 'Not authorized')) return;

    if (branch.suspendedByLimit) {
      return res.status(403).json({
        success: false,
        message: 'This branch is suspended because the restaurant branch limit was exceeded.'
      });
    }
    if (!branch.isActive) {
      return res.status(403).json({ success: false, message: 'Branch is inactive.' });
    }

    const manager = await User.findOne({ branchId: branch._id, role: 'BranchAdmin' });
    if (!manager) {
      return res.status(400).json({
        success: false,
        message: 'Create Branch Login first, then open the branch portal.'
      });
    }

    const validBranch = await validateBranchAdminLogin(manager, res);
    if (!validBranch) return;

    const token = generateToken(manager._id);
    res.json({
      success: true,
      token,
      user: await serializeAuthUser(manager)
    });
  } catch (error) {
    next(error);
  }
};
