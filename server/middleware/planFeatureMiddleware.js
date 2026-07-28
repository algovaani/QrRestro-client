const { adminHasPlanFeature } = require('../utils/planFeatures');

exports.requirePlanFeature = (featureKey) => async (req, res, next) => {
  try {
    if (!req.user || !['Admin', 'BranchAdmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Restaurant access required' });
    }

    const allowed = await adminHasPlanFeature(req.user, featureKey);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_FEATURE_LOCKED',
        featureKey,
        message: 'This feature is not included in your membership plan. Please contact Super Admin to upgrade your plan.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
