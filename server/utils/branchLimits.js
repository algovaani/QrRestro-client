const User = require('../models/User');
const MembershipPlan = require('../models/MembershipPlan');
const Branch = require('../models/Branch');

/** 0 = unlimited branches */
const parseMaxBranches = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
};

const getMaxBranchesForAdmin = async (adminId) => {
  const admin = await User.findById(adminId).select('planName maxBranches');
  if (!admin) return 0;

  const override = parseMaxBranches(admin.maxBranches);
  if (override !== null) return override;

  const plan = admin.planName
    ? await MembershipPlan.findOne({ name: admin.planName }).select('maxBranches')
    : null;

  if (plan) {
    if (plan.maxBranches === undefined || plan.maxBranches === null) return 1;
    const planLimit = parseMaxBranches(plan.maxBranches);
    return planLimit !== null ? planLimit : 0;
  }

  return 1;
};

const sortBranchesForLimit = (branches) =>
  [...branches].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

const isBranchOperational = (branch) =>
  Boolean(branch && branch.isActive !== false && !branch.suspendedByLimit);

/** Suspend branches beyond plan limit; restore when limit increases. */
const enforceBranchLimitForAdmin = async (adminId) => {
  const maxBranches = await getMaxBranchesForAdmin(adminId);
  const branches = await Branch.find({ adminId });
  const sorted = sortBranchesForLimit(branches);

  if (maxBranches === 0) {
    const suspended = await Branch.find({ adminId, suspendedByLimit: true }).select('_id');
    if (suspended.length) {
      await Branch.updateMany(
        { adminId, suspendedByLimit: true },
        { $set: { suspendedByLimit: false, isActive: true } }
      );
      const ids = suspended.map((b) => b._id);
      await User.updateMany(
        { branchId: { $in: ids }, role: 'BranchAdmin' },
        { $set: { isActive: true } }
      );
    }
    return { maxBranches: 0, allowed: sorted.length, suspended: 0 };
  }

  const allowed = sorted.slice(0, maxBranches);
  const excess = sorted.slice(maxBranches);
  const allowedIds = new Set(allowed.map((b) => String(b._id)));

  for (const branch of sorted) {
    const mayRun = allowedIds.has(String(branch._id));

    if (mayRun) {
      if (branch.suspendedByLimit) {
        branch.suspendedByLimit = false;
        branch.isActive = true;
        await branch.save();
        await User.updateMany(
          { branchId: branch._id, role: 'BranchAdmin' },
          { $set: { isActive: true } }
        );
      }
      continue;
    }

    if (!branch.suspendedByLimit || branch.isActive !== false) {
      branch.suspendedByLimit = true;
      branch.isActive = false;
      await branch.save();
      await User.updateMany(
        { branchId: branch._id, role: 'BranchAdmin' },
        { $set: { isActive: false } }
      );
    }
  }

  return {
    maxBranches,
    allowed: allowed.length,
    suspended: excess.length
  };
};

const enforceBranchLimitsForAllAdmins = async ({ log = false } = {}) => {
  const admins = await User.find({ role: 'Admin' }).select('_id');
  let totalSuspended = 0;
  for (const admin of admins) {
    const result = await enforceBranchLimitForAdmin(admin._id);
    totalSuspended += result.suspended || 0;
  }
  if (log) {
    console.log(`[branch-limits] Enforced limits for ${admins.length} admin(s); ${totalSuspended} branch(es) suspended.`);
  }
  return { adminCount: admins.length, totalSuspended };
};

const canCreateBranch = async (adminId) => {
  const maxBranches = await getMaxBranchesForAdmin(adminId);
  if (maxBranches === 0) return { allowed: true, maxBranches, currentCount: 0 };

  const currentCount = await Branch.countDocuments({ adminId });
  return {
    allowed: currentCount < maxBranches,
    maxBranches,
    currentCount
  };
};

const assertBranchOperationalById = async (branchId) => {
  if (!branchId) return { ok: true, branch: null };
  const branch = await Branch.findById(branchId).select('branchName isActive suspendedByLimit adminId');
  if (!branch) {
    return { ok: false, branch: null, message: 'Branch not found' };
  }
  if (!isBranchOperational(branch)) {
    const reason = branch.suspendedByLimit
      ? 'This branch is suspended because your plan branch limit was exceeded. Contact Super Admin or delete extra branches.'
      : 'This branch is currently inactive.';
    return { ok: false, branch, message: reason };
  }
  return { ok: true, branch };
};

module.exports = {
  parseMaxBranches,
  getMaxBranchesForAdmin,
  enforceBranchLimitForAdmin,
  enforceBranchLimitsForAllAdmins,
  canCreateBranch,
  isBranchOperational,
  assertBranchOperationalById
};
