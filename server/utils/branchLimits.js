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

module.exports = {
  parseMaxBranches,
  getMaxBranchesForAdmin,
  canCreateBranch
};
