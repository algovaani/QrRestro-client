const jwt = require('jsonwebtoken');
const User = require('../models/User');

const loadUserFromToken = async (req, res) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Token missing.'
    });
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_restaurant_qr_2026_safe');

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.'
      });
      return null;
    }

    req.user = user;
    return user;
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid or expired token.'
    });
    return null;
  }
};

/** Login valid — expired membership allowed (renewal page, request renewal). */
exports.protectAllowExpired = async (req, res, next) => {
  const user = await loadUserFromToken(req, res);
  if (!user) return;
  next();
};

exports.protect = async (req, res, next) => {
  const user = await loadUserFromToken(req, res);
  if (!user) return;

  if (user.role === 'Admin' && !user.isActive) {
    return res.status(403).json({
      success: false,
      code: 'ACCOUNT_DEACTIVATED',
      message: 'Your account has been deactivated. Please renew membership to continue.',
      membershipOfferSent: Boolean(user.membershipOfferSent),
      membershipOfferPlanName: user.membershipOfferPlanName || '',
      renewalRequested: Boolean(user.renewalRequested)
    });
  }

  if (user.role === 'Admin') {
    const now = new Date();
    const expiryDate = user.subscriptionEndsAt || user.trialEndsAt;

    if (expiryDate && now > expiryDate) {
      if (user.planStatus !== 'Expired') {
        user.planStatus = 'Expired';
        await user.save();
      }

      return res.status(403).json({
        success: false,
        code: 'MEMBERSHIP_EXPIRED',
        message: 'Your membership plan has expired. Please renew with Super Admin.',
        planStatus: 'Expired',
        renewalRequested: user.renewalRequested
      });
    }
  }

  if (user.role === 'BranchAdmin') {
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your branch login has been deactivated. Contact restaurant admin.'
      });
    }

    const parent = user.restaurantAdminId
      ? await User.findById(user.restaurantAdminId).select('isActive planStatus subscriptionEndsAt trialEndsAt restaurantName')
      : null;

    if (!parent || !parent.isActive) {
      return res.status(403).json({
        success: false,
        code: 'RESTAURANT_INACTIVE',
        message: 'Restaurant account is inactive. Contact restaurant admin.'
      });
    }

    const expiryDate = parent.subscriptionEndsAt || parent.trialEndsAt;
    if (expiryDate && new Date() > new Date(expiryDate)) {
      return res.status(403).json({
        success: false,
        code: 'MEMBERSHIP_EXPIRED',
        message: 'Restaurant membership expired. Branch login is temporarily unavailable.'
      });
    }
  }

  next();
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

exports.isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'SuperAdmin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Only Super Admin can perform this action.'
  });
};
