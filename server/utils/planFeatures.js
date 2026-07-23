/** Central catalog — naye features yahan add karenge */
const PLAN_FEATURE_CATALOG = [
  { key: 'orders', label: 'Orders & Dashboard', group: 'Core', description: 'Live orders, dashboard stats' },
  { key: 'branches', label: 'Multi-Branch Management', group: 'Core', description: 'Kai branches aur branch logins' },
  { key: 'branch_portal', label: 'Branch Manager Portal', group: 'Core', description: 'Har branch ka alag manager login' },
  { key: 'reports', label: 'Sales Reports', group: 'Analytics', description: 'Branch-wise sales & item reports' },
  { key: 'inventory', label: 'Inventory & Stock', group: 'Operations', description: 'Branch-wise stock, low stock alerts' },
  { key: 'settings', label: 'Settings & UPI', group: 'Core', description: 'Restaurant settings, tax, UPI' }
];

const DEFAULT_FEATURE_KEYS = ['orders', 'branches', 'branch_portal', 'reports', 'settings'];

const catalogMap = Object.fromEntries(PLAN_FEATURE_CATALOG.map((f) => [f.key, f]));

exports.PLAN_FEATURE_CATALOG = PLAN_FEATURE_CATALOG;

exports.isValidFeatureKey = (key) => Boolean(catalogMap[key]);

exports.getFeatureLabel = (key) => catalogMap[key]?.label || key;

exports.getFeatureCatalog = () => PLAN_FEATURE_CATALOG;

exports.keysToFeatureLabels = (keys = []) =>
  (keys || []).filter((k) => catalogMap[k]).map((k) => catalogMap[k].label);

exports.normalizeFeatureKeys = (keys) => {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((k) => exports.isValidFeatureKey(k)))];
};

/** Legacy plans jinke paas featureKeys nahi — features strings se guess karo */
exports.inferFeatureKeysFromLegacy = (features = []) => {
  const text = (Array.isArray(features) ? features.join(' ') : String(features || '')).toLowerCase();
  const keys = new Set(DEFAULT_FEATURE_KEYS);

  if (/inventory|stock/.test(text)) keys.add('inventory');
  if (/report|analytics|sales/.test(text)) keys.add('reports');
  if (/branch/.test(text)) keys.add('branches');
  if (/order|dashboard|kds|kitchen|qr/.test(text)) keys.add('orders');
  if (/setting|upi/.test(text)) keys.add('settings');

  return [...keys];
};

exports.resolvePlanFeatures = (plan) => {
  if (!plan) {
    return {
      featureKeys: [...DEFAULT_FEATURE_KEYS],
      features: exports.keysToFeatureLabels(DEFAULT_FEATURE_KEYS)
    };
  }

  const raw = plan.toObject ? plan.toObject() : plan;
  let featureKeys = exports.normalizeFeatureKeys(raw.featureKeys);
  if (!featureKeys.length) {
    featureKeys = exports.inferFeatureKeysFromLegacy(raw.features);
  }
  if (!featureKeys.length) {
    featureKeys = [...DEFAULT_FEATURE_KEYS];
  }

  return {
    featureKeys,
    features: exports.keysToFeatureLabels(featureKeys)
  };
};

exports.resolvePlanFeaturesByName = async (planName) => {
  const MembershipPlan = require('../models/MembershipPlan');
  const plan = planName ? await MembershipPlan.findOne({ name: planName }) : null;
  return exports.resolvePlanFeatures(plan);
};

exports.adminHasPlanFeature = async (user, featureKey) => {
  if (!user || user.role !== 'Admin') return false;
  const { featureKeys } = await exports.resolvePlanFeaturesByName(user.planName);
  return featureKeys.includes(featureKey);
};

exports.DEFAULT_FEATURE_KEYS = DEFAULT_FEATURE_KEYS;

exports.getPlanFeatureCatalogHandler = (req, res) => {
  res.json({ success: true, catalog: exports.getFeatureCatalog() });
};
