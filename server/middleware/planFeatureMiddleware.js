const { adminHasPlanFeature } = require('../utils/planFeatures');

exports.requirePlanFeature = (featureKey) => async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }

    const allowed = await adminHasPlanFeature(req.user, featureKey);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_FEATURE_LOCKED',
        featureKey,
        message: 'Ye feature aapke membership plan mein included nahi hai. Super Admin se plan upgrade karwayein.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
