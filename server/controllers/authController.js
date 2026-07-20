const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_jwt_key_restaurant_qr_2026_safe', {
    expiresIn: '7d'
  });
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

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact Super Admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
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
      user: {
        _id: user._id,
        name: user.name,
        restaurantName: user.restaurantName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        planName: user.planName,
        planStatus: isExpired ? 'Expired' : user.planStatus,
        renewalRequested: user.renewalRequested,
        renewalRequestDate: user.renewalRequestDate,
        requestedPlanName: user.requestedPlanName || '',
        membershipOfferSent: user.membershipOfferSent,
        membershipOfferPlanName: user.membershipOfferPlanName || '',
        membershipOfferSentAt: user.membershipOfferSentAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
        isExpired: Boolean(isExpired)
      }
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
    const expiry = user.subscriptionEndsAt || user.trialEndsAt;
    const isExpired = user.role === 'Admin' && expiry && new Date(expiry) < new Date();

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        isExpired: Boolean(isExpired),
        planStatus: isExpired ? 'Expired' : user.planStatus
      }
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
    res.json({ success: true, user });
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
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
