const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Branch = require('../models/Branch');
const { getDaysRemaining, withMembershipDays, adminHasUsedFreeTrial } = require('../utils/membershipDays');
const { resolvePlanFeaturesByName } = require('../utils/planFeatures');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_jwt_key_restaurant_qr_2026_safe', {
    expiresIn: '7d'
  });
};

const validateBranchAdminLogin = async (user, res) => {
  if (!user.isActive) {
    res.status(403).json({ success: false, message: 'Branch login deactivated. Contact restaurant admin.' });
    return false;
  }
  if (!user.branchId || !user.restaurantAdminId) {
    res.status(403).json({ success: false, message: 'Branch login is not configured correctly.' });
    return false;
  }

  const parent = await User.findById(user.restaurantAdminId);
  if (!parent || !parent.isActive) {
    res.status(403).json({ success: false, message: 'Restaurant account is inactive.' });
    return false;
  }

  const expiryDate = parent.subscriptionEndsAt || parent.trialEndsAt;
  if (expiryDate && new Date() > new Date(expiryDate)) {
    res.status(403).json({ success: false, message: 'Restaurant membership expired. Branch login unavailable.' });
    return false;
  }

  const branch = await Branch.findOne({ _id: user.branchId, adminId: parent._id, isActive: true });
  if (!branch) {
    res.status(403).json({ success: false, message: 'Branch not found or inactive.' });
    return false;
  }

  return branch;
};

const serializeAuthUser = async (user, isExpired = false) => {
  const base = withMembershipDays({
    _id: user._id,
    name: user.name,
    restaurantName: user.restaurantName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    restaurantAdminId: user.restaurantAdminId || null,
    branchId: user.branchId || null,
    planName: user.planName,
    planStatus: isExpired ? 'Expired' : user.planStatus,
    renewalRequested: user.renewalRequested,
    renewalRequestDate: user.renewalRequestDate,
    requestedPlanName: user.requestedPlanName || '',
    membershipOfferSent: user.membershipOfferSent,
    membershipOfferPlanName: user.membershipOfferPlanName || '',
    membershipOfferSentAt: user.membershipOfferSentAt,
    subscriptionEndsAt: user.subscriptionEndsAt,
    trialEndsAt: user.trialEndsAt,
    freeTrialUsed: adminHasUsedFreeTrial(user),
    isExpired: Boolean(isExpired)
  });

  if (user.role === 'BranchAdmin' && user.branchId) {
    const branch = await Branch.findById(user.branchId).select('branchName');
    base.branchName = branch?.branchName || '';
    if (user.restaurantAdminId) {
      const parent = await User.findById(user.restaurantAdminId).select('restaurantName');
      if (parent?.restaurantName) base.restaurantName = parent.restaurantName;
    }
  }

  if (user.role === 'Admin' && user.planName) {
    const planFeatures = await resolvePlanFeaturesByName(user.planName);
    base.planFeatureKeys = planFeatures.featureKeys;
    base.planFeatures = planFeatures.features;
  }

  return base;
};

// @desc Auth user & get token
// @route POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.role === 'BranchAdmin') {
      const branch = await validateBranchAdminLogin(user, res);
      if (!branch) return;

      const token = generateToken(user._id);
      return res.json({
        success: true,
        token,
        user: await serializeAuthUser(user)
      });
    }

    const token = generateToken(user._id);
    const now = new Date();
    const expiryDate = user.subscriptionEndsAt || user.trialEndsAt;
    const isExpired = user.role === 'Admin' && expiryDate && now > expiryDate;

    if (isExpired && user.planStatus !== 'Expired') {
      user.planStatus = 'Expired';
      await user.save();
    }

    res.json({
      success: true,
      token,
      user: await serializeAuthUser(user, isExpired)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get subscription status (works even when plan expired)
// @route GET /api/auth/subscription-status
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user.role === 'Admin' && adminHasUsedFreeTrial(user) && !user.freeTrialUsed) {
      user.freeTrialUsed = true;
      await user.save();
    }

    const expiry = user.subscriptionEndsAt || user.trialEndsAt;
    const isExpired = user.role === 'Admin' && expiry && new Date(expiry) < new Date();
    const daysRemaining = getDaysRemaining(expiry);

    res.json({
      success: true,
      user: await serializeAuthUser(user, isExpired)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get current user profile
// @route GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const expiry = user.subscriptionEndsAt || user.trialEndsAt;
    const isExpired = user.role === 'Admin' && expiry && new Date(expiry) < new Date();

    res.json({
      success: true,
      user: await serializeAuthUser(user, isExpired)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Change Password
// @route PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    if (user.rawPassword !== undefined) {
      user.rawPassword = newPassword;
    }
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc Change Email
// @route PUT /api/auth/change-email
exports.changeEmail = async (req, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !currentPassword) {
      return res.status(400).json({ success: false, message: 'Please provide new email and current password' });
    }

    const cleanEmail = newEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    if (user.email === cleanEmail) {
      return res.status(400).json({ success: false, message: 'New email is same as current email' });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This email is already in use' });
    }

    user.email = cleanEmail;
    await user.save();

    res.json({
      success: true,
      message: 'Email updated successfully',
      email: user.email
    });
  } catch (error) {
    next(error);
  }
};
