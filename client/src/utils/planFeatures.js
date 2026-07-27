/** Client-side plan feature helpers (keys must match server/utils/planFeatures.js) */

export const PLAN_FEATURE_ROUTE_MAP = {
  orders: '/admin/orders',
  branches: '/admin/branches',
  reports: '/admin/reports',
  inventory: '/admin/inventory',
  settings: '/admin/settings'
};

export function hasPlanFeature(user, featureKey) {
  if (!user || !['Admin', 'BranchAdmin'].includes(user.role)) return false;
  // Inventory is always available so restaurant admin can audit every branch's stock
  if (featureKey === 'inventory') return true;
  const keys = user.planFeatureKeys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return true;
  }
  return keys.includes(featureKey);
}

export function getPlanFeaturesForDisplay(user) {
  if (Array.isArray(user?.planFeatures) && user.planFeatures.length > 0) {
    return user.planFeatures;
  }
  return [];
}

export function getSelectedPlanFeatures(plans, planName) {
  const plan = plans.find((p) => p.name === planName);
  if (!plan) return { featureKeys: [], features: [] };
  return {
    featureKeys: plan.featureKeys || [],
    features: plan.features || []
  };
}

export function planIncludesFeature(plans, planName, featureKey) {
  const { featureKeys } = getSelectedPlanFeatures(plans, planName);
  return featureKeys.includes(featureKey);
}
