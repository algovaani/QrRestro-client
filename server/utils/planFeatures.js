const PlanFeature = require('../models/PlanFeature');

const DEFAULT_SYSTEM_FEATURE_KEYS = [
  'tables_qr',
  'orders',
  'branches',
  'branch_portal',
  'inventory',
  'reports',
  'settings'
];

const DEFAULT_PLAN_FEATURES = [
  {
    key: 'tables_qr',
    label: 'Tables & QR Codes',
    group: 'Dining',
    menuKey: 'tables_qr',
    description: 'Table QR code generation, ordering menu, and digital categories',
    status: 'Active',
    assignableToBranch: true,
    sortOrder: 1
  },
  {
    key: 'orders',
    label: 'Live Orders & KDS',
    group: 'Operations',
    menuKey: 'orders',
    description: 'Real-time order tracking, order status, and kitchen display screen',
    status: 'Active',
    assignableToBranch: true,
    sortOrder: 2
  },
  {
    key: 'branches',
    label: 'Branch Management',
    group: 'Multi-Outlet',
    menuKey: 'branches',
    description: 'Add and manage multiple restaurant branches',
    status: 'Active',
    assignableToBranch: false,
    sortOrder: 3
  },
  {
    key: 'branch_portal',
    label: 'Branch Staff Portal',
    group: 'Multi-Outlet',
    menuKey: 'branch_portal',
    description: 'Branch manager and kitchen staff portal login',
    status: 'Active',
    assignableToBranch: true,
    sortOrder: 4
  },
  {
    key: 'inventory',
    label: 'Kitchen Stock & Inventory',
    group: 'Operations',
    menuKey: 'inventory',
    description: 'Kitchen stock tracking, low stock alerts, and ingredient management',
    status: 'Active',
    assignableToBranch: true,
    sortOrder: 5
  },
  {
    key: 'reports',
    label: 'Sales Reports & Analytics',
    group: 'Management',
    menuKey: 'reports',
    description: 'Revenue analytics, sales trends, and date range reports',
    status: 'Active',
    assignableToBranch: false,
    sortOrder: 6
  },
  {
    key: 'settings',
    label: 'Settings & UPI Payments',
    group: 'Configuration',
    menuKey: 'settings',
    description: 'Restaurant profile, custom UPI QR codes, and configurations',
    status: 'Active',
    assignableToBranch: false,
    sortOrder: 7
  }
];

exports.DEFAULT_SYSTEM_FEATURE_KEYS = DEFAULT_SYSTEM_FEATURE_KEYS;
exports.DEFAULT_PLAN_FEATURES = DEFAULT_PLAN_FEATURES;

/** Ensure default feature catalog documents exist in PlanFeature collection */
exports.ensureDefaultPlanFeatures = async () => {
  try {
    for (const item of DEFAULT_PLAN_FEATURES) {
      await PlanFeature.findOneAndUpdate(
        { key: item.key },
        { $setOnInsert: item },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('[planFeatures] Failed to ensure default plan features:', err.message);
  }
};

/** Migrate any existing membership plans that have empty featureKeys */
exports.migrateExistingPlansFeatures = async () => {
  try {
    const MembershipPlan = require('../models/MembershipPlan');
    const plans = await MembershipPlan.find();
    for (const plan of plans) {
      let needsSave = false;
      if (!Array.isArray(plan.featureKeys) || plan.featureKeys.length === 0) {
        const inferred = exports.inferFeatureKeysFromLegacy(plan.features);
        if (inferred.length > 0) {
          if (!inferred.includes('tables_qr')) inferred.push('tables_qr');
          if (!inferred.includes('branches')) inferred.push('branches');
          if (!inferred.includes('branch_portal')) inferred.push('branch_portal');
          plan.featureKeys = inferred;
        } else {
          plan.featureKeys = [...DEFAULT_SYSTEM_FEATURE_KEYS];
        }
        needsSave = true;
      }
      if (!Array.isArray(plan.features) || plan.features.length === 0) {
        plan.features = await exports.keysToFeatureLabels(plan.featureKeys);
        needsSave = true;
      }
      if (needsSave) {
        await plan.save();
      }
    }
  } catch (err) {
    console.error('[planFeatures] Failed to migrate existing plans features:', err.message);
  }
};

async function getAllFeatureDocs({ activeOnly = false } = {}) {
  const query = activeOnly ? { status: 'Active' } : {};
  let docs = await PlanFeature.find(query).sort({ sortOrder: 1, label: 1 }).lean();
  if (!docs || docs.length === 0) {
    docs = DEFAULT_PLAN_FEATURES.filter((f) => !activeOnly || f.status === 'Active');
  }
  return docs;
}

async function getFeatureMap(options) {
  const catalog = await getAllFeatureDocs(options);
  return Object.fromEntries(catalog.map((feature) => [feature.key, feature]));
}

exports.getFeatureCatalog = async (options) => getAllFeatureDocs(options);

exports.isValidFeatureKey = async (key, options = { activeOnly: false }) => {
  if (!key) return false;
  const normalized = String(key).trim().toLowerCase();
  const feature = await PlanFeature.findOne({
    key: normalized,
    ...(options.activeOnly ? { status: 'Active' } : {})
  }).lean();
  if (feature) return true;
  return DEFAULT_SYSTEM_FEATURE_KEYS.includes(normalized);
};

exports.keysToFeatureLabels = async (keys = [], options = { activeOnly: false }) => {
  const map = await getFeatureMap(options);
  return (keys || []).map((key) => {
    const k = String(key || '').trim().toLowerCase();
    if (map[k]?.label) return map[k].label;
    const defaultItem = DEFAULT_PLAN_FEATURES.find((f) => f.key === k);
    return defaultItem ? defaultItem.label : k;
  });
};

exports.normalizeFeatureKeys = async (keys, options = { activeOnly: false }) => {
  if (!Array.isArray(keys)) return [];
  const map = await getFeatureMap(options);
  return [...new Set(keys.map((key) => String(key || '').trim().toLowerCase()).filter((key) => {
    if (map[key]) return true;
    return DEFAULT_SYSTEM_FEATURE_KEYS.includes(key);
  }))];
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
      featureKeys: [...DEFAULT_SYSTEM_FEATURE_KEYS],
      features: await exports.keysToFeatureLabels(DEFAULT_SYSTEM_FEATURE_KEYS)
    };
  }

  const raw = plan.toObject ? plan.toObject() : plan;
  let rawKeys = Array.isArray(raw.featureKeys) ? raw.featureKeys.filter(Boolean) : [];

  if (rawKeys.length === 0) {
    const inferred = exports.inferFeatureKeysFromLegacy(raw.features);
    if (inferred.length > 0) {
      if (!inferred.includes('tables_qr')) inferred.push('tables_qr');
      if (!inferred.includes('branches')) inferred.push('branches');
      if (!inferred.includes('branch_portal')) inferred.push('branch_portal');
      rawKeys = inferred;
    } else {
      rawKeys = [...DEFAULT_SYSTEM_FEATURE_KEYS];
    }
  }

  const featureKeys = await exports.normalizeFeatureKeys(rawKeys);
  const finalKeys = featureKeys.length ? featureKeys : [...DEFAULT_SYSTEM_FEATURE_KEYS];

  return {
    featureKeys: finalKeys,
    features: await exports.keysToFeatureLabels(finalKeys)
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
  const combined = [...new Set([...(planFeatureKeys || []), ...normalizedExtraKeys])];
  return combined.length ? combined : [...DEFAULT_SYSTEM_FEATURE_KEYS];
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
  const effectivePlanKeys = normalizedPlanKeys.length ? normalizedPlanKeys : [...DEFAULT_SYSTEM_FEATURE_KEYS];
  const branchKeys = await exports.normalizeFeatureKeys(branch?.featureKeys || []);
  if (!branchKeys.length) return effectivePlanKeys;
  const planSet = new Set(effectivePlanKeys);
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
  if (planFeatureKeys.includes(normalizedFeatureKey)) {
    if (user.role === 'BranchAdmin') {
      const branchFeatureKeys = await exports.resolveBranchFeatureKeys(branch, planFeatureKeys);
      return branchFeatureKeys.includes(normalizedFeatureKey);
    }
    return true;
  }

  // Active admin fallback: if plan is active and not expired, allow core features
  if (user.role === 'Admin' && user.isActive !== false && user.planStatus !== 'Expired') {
    return DEFAULT_SYSTEM_FEATURE_KEYS.includes(normalizedFeatureKey);
  }

  return false;
};

exports.getPlanFeatureCatalogHandler = async (req, res, next) => {
  try {
    res.json({ success: true, catalog: await exports.getFeatureCatalog() });
  } catch (error) {
    next(error);
  }
};
