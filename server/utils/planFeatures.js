const PlanFeature = require('../models/PlanFeature');

async function getAllFeatureDocs({ activeOnly = false } = {}) {
  const query = activeOnly ? { status: 'Active' } : {};
  return PlanFeature.find(query).sort({ sortOrder: 1, label: 1 }).lean();
}

async function getFeatureMap(options) {
  const catalog = await getAllFeatureDocs(options);
  return Object.fromEntries(catalog.map((feature) => [feature.key, feature]));
}

exports.getFeatureCatalog = async (options) => getAllFeatureDocs(options);

exports.isValidFeatureKey = async (key, options = { activeOnly: false }) => {
  if (!key) return false;
  const feature = await PlanFeature.findOne({
    key: String(key).trim().toLowerCase(),
    ...(options.activeOnly ? { status: 'Active' } : {})
  }).lean();
  return Boolean(feature);
};

exports.keysToFeatureLabels = async (keys = [], options = { activeOnly: false }) => {
  const map = await getFeatureMap(options);
  return (keys || []).filter((key) => map[key]).map((key) => map[key].label);
};

exports.normalizeFeatureKeys = async (keys, options = { activeOnly: false }) => {
  if (!Array.isArray(keys)) return [];
  const map = await getFeatureMap(options);
  return [...new Set(keys.map((key) => String(key || '').trim().toLowerCase()).filter((key) => map[key]))];
};

/** Legacy plans jinke paas featureKeys nahi — features strings se guess karo */
exports.inferFeatureKeysFromLegacy = (features = []) => {
  const text = (Array.isArray(features) ? features.join(' ') : String(features || '')).toLowerCase();
  const keys = new Set();

  if (/inventory|stock/.test(text)) keys.add('inventory');
  if (/report|analytics|sales/.test(text)) keys.add('reports');
  if (/branch/.test(text)) {
    keys.add('branches');
    keys.add('branch_portal');
  }
  if (/qr|table/.test(text)) keys.add('tables_qr');
  if (/order|dashboard|kds|kitchen/.test(text)) keys.add('orders');
  if (/setting|upi/.test(text)) keys.add('settings');

  return [...keys];
};

exports.resolvePlanFeatures = async (plan) => {
  if (!plan) {
    return {
      featureKeys: [],
      features: []
    };
  }

  const raw = plan.toObject ? plan.toObject() : plan;
  // Strict: sirf Super Admin ne plan me jo featureKeys select kiye, wahi allow
  const featureKeys = await exports.normalizeFeatureKeys(raw.featureKeys || []);

  return {
    featureKeys,
    features: await exports.keysToFeatureLabels(featureKeys)
  };
};

exports.resolvePlanFeaturesByName = async (planName) => {
  const MembershipPlan = require('../models/MembershipPlan');
  const plan = planName ? await MembershipPlan.findOne({ name: planName }) : null;
  return exports.resolvePlanFeatures(plan);
};

exports.resolveAdminFeatureKeys = async (planName, extraFeatureKeys = []) => {
  const { featureKeys: planFeatureKeys } = await exports.resolvePlanFeaturesByName(planName);
  const normalizedExtraKeys = await exports.normalizeFeatureKeys(extraFeatureKeys);
  return [...new Set([...(planFeatureKeys || []), ...normalizedExtraKeys])];
};

exports.resolveAdminFeatures = async (planName, extraFeatureKeys = []) => {
  const featureKeys = await exports.resolveAdminFeatureKeys(planName, extraFeatureKeys);
  return {
    featureKeys,
    features: await exports.keysToFeatureLabels(featureKeys)
  };
};

exports.resolveBranchFeatureKeys = async (branch, planFeatureKeys = []) => {
  const normalizedPlanKeys = await exports.normalizeFeatureKeys(planFeatureKeys);
  const branchKeys = await exports.normalizeFeatureKeys(branch?.featureKeys || []);
  if (!branchKeys.length) return normalizedPlanKeys;
  const planSet = new Set(normalizedPlanKeys);
  return branchKeys.filter((key) => planSet.has(key));
};

exports.resolveBranchFeatures = async (branch, planFeatureKeys = []) => {
  const featureKeys = await exports.resolveBranchFeatureKeys(branch, planFeatureKeys);
  return {
    featureKeys,
    features: await exports.keysToFeatureLabels(featureKeys)
  };
};

exports.adminHasPlanFeature = async (user, featureKey) => {
  if (!user || !featureKey) return false;
  const normalizedFeatureKey = String(featureKey).trim().toLowerCase();

  let planName = user.planName;
  let branch = null;

  if (user.role === 'BranchAdmin' && user.restaurantAdminId) {
    const User = require('../models/User');
    const Branch = require('../models/Branch');
    const parent = await User.findById(user.restaurantAdminId).select('planName extraFeatureKeys');
    planName = parent?.planName || planName;
    user.extraFeatureKeys = parent?.extraFeatureKeys || [];
    if (user.branchId) {
      branch = await Branch.findById(user.branchId).select('featureKeys');
    }
  } else if (user.role !== 'Admin') {
    return false;
  }

  const planFeatureKeys = await exports.resolveAdminFeatureKeys(planName, user.extraFeatureKeys || []);
  if (!planFeatureKeys.includes(normalizedFeatureKey)) {
    return false;
  }

  if (user.role === 'BranchAdmin') {
    const branchFeatureKeys = await exports.resolveBranchFeatureKeys(branch, planFeatureKeys);
    return branchFeatureKeys.includes(normalizedFeatureKey);
  }

  return true;
};

exports.getPlanFeatureCatalogHandler = async (req, res, next) => {
  try {
    res.json({ success: true, catalog: await exports.getFeatureCatalog() });
  } catch (error) {
    next(error);
  }
};
