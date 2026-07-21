const User = require('../models/User');
const { emitMembershipRenewalRequest, emitMembershipActivated, emitMembershipOfferSent, emitMembershipRenewalRejected, emitAdminStatusChanged } = require('../socket/socketHandler');
const Setting = require('../models/Setting');
const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const MembershipPlan = require('../models/MembershipPlan');
const { getDaysRemaining, formatExpiryDate, formatRenewalMessage, withMembershipDays, isTrialPlanName, inferPlanNameFromDays, addMembershipDays } = require('../utils/membershipDays');

const getPlanConfig = async (planName) => {
  const plan = await MembershipPlan.findOne({ name: planName });
  if (plan) {
    return {
      durationDays: plan.durationDays,
      planStatus: plan.price === 0 || plan.name.toLowerCase().includes('trial') ? 'Trialing' : 'Active'
    };
  }

  if (planName === 'Annual Plan') return { durationDays: 365, planStatus: 'Active' };
  if (planName === 'Quarterly Plan') return { durationDays: 90, planStatus: 'Active' };
  if (planName === 'Monthly Plan') return { durationDays: 30, planStatus: 'Active' };
  return { durationDays: 5, planStatus: 'Trialing' };
};

// @desc Get Super Admin Dashboard Overview Stats
// @route GET /api/super-admin/stats
exports.getSuperAdminStats = async (req, res, next) => {
  try {
    const totalAdmins = await User.countDocuments({ role: 'Admin' });
    const activeAdmins = await User.countDocuments({ role: 'Admin', isActive: true, planStatus: { $ne: 'Expired' } });
    const trialingAdmins = await User.countDocuments({ role: 'Admin', planStatus: 'Trialing' });
    const expiredAdmins = await User.countDocuments({ role: 'Admin', planStatus: 'Expired' });
    const renewalRequestsCount = await User.countDocuments({ role: 'Admin', renewalRequested: true });

    res.json({
      success: true,
      stats: {
        totalAdmins,
        activeAdmins,
        trialingAdmins,
        expiredAdmins,
        renewalRequestsCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get All Restaurant Admin Accounts (including login details for Super Admin)
// @route GET /api/super-admin/admins
exports.getAllAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'Admin' }).select('-password').sort({ createdAt: -1 });

    const processedAdmins = admins.map(admin => withMembershipDays(admin.toObject()));

    res.json({
      success: true,
      count: processedAdmins.length,
      admins: processedAdmins
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create New Restaurant Admin Account (With Selected Membership Plan & Duration)
// @route POST /api/super-admin/admins
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, restaurantName, email, password, planName } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const selectedPlan = planName || '5-Day Free Trial';
    const { durationDays, planStatus } = await getPlanConfig(selectedPlan);

    const now = new Date();
    const expiryDate = addMembershipDays(now, durationDays);

    const newAdmin = await User.create({
      name,
      restaurantName: restaurantName || `${name}'s Restaurant`,
      email,
      password,
      rawPassword: password,
      role: 'Admin',
      isActive: true,
      planName: selectedPlan,
      planStatus,
      trialEndsAt: expiryDate,
      subscriptionEndsAt: expiryDate,
      renewalRequested: false
    });

    await Setting.create({
      adminId: newAdmin._id,
      restaurantName: newAdmin.restaurantName,
      upiId: `${email.split('@')[0]}@upi`
    });

    const daysRemaining = getDaysRemaining(expiryDate);

    res.status(201).json({
      success: true,
      message: `Admin created with ${selectedPlan} — valid for ${daysRemaining} days (until ${formatExpiryDate(expiryDate)})`,
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        restaurantName: newAdmin.restaurantName,
        email: newAdmin.email,
        rawPassword: newAdmin.rawPassword,
        planName: newAdmin.planName,
        subscriptionEndsAt: newAdmin.subscriptionEndsAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update Restaurant Admin Account Details & Membership Plan
// @route PUT /api/super-admin/admins/:id
exports.updateAdmin = async (req, res, next) => {
  try {
    const { name, restaurantName, email, password, planName, extendDays } = req.body;

    let admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    if (name) admin.name = name;
    if (restaurantName) admin.restaurantName = restaurantName;
    if (email) admin.email = email;
    if (password) {
      admin.password = password;
      admin.rawPassword = password;
    }

    const previousPlanName = admin.planName;
    if (planName) admin.planName = planName;

    const planChanged = planName && planName !== previousPlanName;
    const hasExtendDays = extendDays !== undefined && extendDays !== null && String(extendDays).trim() !== '';

    if (planChanged || hasExtendDays) {
      admin.planStatus = 'Active';
      admin.isActive = true;

      const config = await getPlanConfig(planName || admin.planName);
      const daysToAdd = hasExtendDays ? parseInt(extendDays, 10) : config.durationDays;
      const now = new Date();
      admin.subscriptionEndsAt = addMembershipDays(now, daysToAdd);
      admin.trialEndsAt = admin.subscriptionEndsAt;
      admin.renewalRequested = false;
      admin.renewalRequestDate = null;
      admin.requestedPlanName = '';
      admin.membershipOfferSent = false;
      admin.membershipOfferPlanName = '';
      admin.membershipOfferSentAt = null;
    }

    await admin.save();

    res.json({
      success: true,
      message: 'Admin account and plan updated successfully',
      admin
    });
  } catch (error) {
    next(error);
  }
};

// @desc Toggle Active / Deactive Admin Account Login Access
// @route PATCH /api/super-admin/admins/:id/toggle-status
exports.toggleAdminStatus = async (req, res, next) => {
  try {
    let admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    admin.isActive = !admin.isActive;

    if (!admin.isActive) {
      admin.planStatus = 'Expired';
      admin.membershipOfferSent = true;
      admin.membershipOfferPlanName = admin.planName || 'Monthly Plan';
      admin.membershipOfferSentAt = new Date();
      admin.renewalRequested = false;
      admin.renewalRequestDate = null;
      admin.requestedPlanName = '';
    } else {
      admin.membershipOfferSent = false;
      admin.membershipOfferPlanName = '';
      admin.membershipOfferSentAt = null;
      admin.renewalRequested = false;
      admin.renewalRequestDate = null;
      admin.requestedPlanName = '';
    }

    await admin.save();

    emitAdminStatusChanged(admin);
    if (!admin.isActive) {
      emitMembershipOfferSent(admin);
    }

    res.json({
      success: true,
      message: `Admin account ${admin.isActive ? 'ACTIVATED' : 'DEACTIVATED'} successfully`,
      admin: {
        id: admin._id,
        name: admin.name,
        isActive: admin.isActive,
        membershipOfferSent: admin.membershipOfferSent,
        renewalRequested: admin.renewalRequested
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Renew / Extend Membership Plan for Admin Account
// @route PATCH /api/super-admin/admins/:id/renew
exports.renewAdminMembership = async (req, res, next) => {
  try {
    const { planName, extendDays } = req.body;

    let admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    const daysToAdd = parseInt(extendDays, 10) || (await getPlanConfig(planName || admin.planName)).durationDays;
    const now = new Date();

    let selectedPlan = planName || admin.planName || 'Monthly Plan';
    if (isTrialPlanName(selectedPlan) && daysToAdd > 5) {
      selectedPlan = inferPlanNameFromDays(daysToAdd);
    }

    const planConfig = await getPlanConfig(selectedPlan);
    // Fresh period from payment/activation date — do not stack leftover days
    const newExpiryDate = addMembershipDays(now, daysToAdd);

    admin.planName = selectedPlan;
    admin.planStatus = planConfig.planStatus;
    admin.subscriptionEndsAt = newExpiryDate;
    admin.trialEndsAt = newExpiryDate;
    admin.isActive = true;
    admin.renewalRequested = false;
    admin.renewalRequestDate = null;
    admin.requestedPlanName = '';
    admin.renewalPaymentProof = '';
    admin.renewalRejectionReason = '';
    admin.renewalRejectedAt = null;
    admin.membershipOfferSent = false;
    admin.membershipOfferPlanName = '';
    admin.membershipOfferSentAt = null;

    await admin.save();

    emitMembershipActivated(admin);

    const daysRemaining = getDaysRemaining(newExpiryDate);

    res.json({
      success: true,
      message: formatRenewalMessage(admin.planName, newExpiryDate),
      daysRemaining,
      daysAdded: daysToAdd,
      expiryDate: newExpiryDate,
      admin
    });
  } catch (error) {
    next(error);
  }
};

// @desc Reactivate expired admin after payment received (same as renew)
// @route PATCH /api/super-admin/admins/:id/reactivate
exports.reactivateAdminMembership = async (req, res, next) => {
  req.body = req.body || {};
  return exports.renewAdminMembership(req, res, next);
};

// @desc Delete Admin Account
// @route DELETE /api/super-admin/admins/:id
exports.deleteAdmin = async (req, res, next) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    const adminId = admin._id;

    await Promise.all([
      Table.deleteMany({ adminId }),
      Category.deleteMany({ adminId }),
      MenuItem.deleteMany({ adminId }),
      Order.deleteMany({ adminId }),
      Setting.deleteMany({ adminId })
    ]);

    await admin.deleteOne();

    res.json({
      success: true,
      message: 'Restaurant Admin account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Super Admin sends membership offer to admin (shows Buy/Renew in admin panel)
// @route PATCH /api/super-admin/admins/:id/send-membership-offer
exports.sendMembershipOffer = async (req, res, next) => {
  try {
    const { planName } = req.body;

    const admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    admin.membershipOfferSent = true;
    admin.membershipOfferPlanName = planName ? String(planName).trim() : (admin.planName || '');
    admin.membershipOfferSentAt = new Date();
    await admin.save();

    emitMembershipOfferSent(admin);

    res.json({
      success: true,
      message: `Membership offer sent to ${admin.restaurantName}! Admin ab Buy/Renew Membership dekh sakta hai.`,
      admin
    });
  } catch (error) {
    next(error);
  }
};

// @desc Restaurant Admin Submit Renewal Request to Super Admin
// @route POST /api/super-admin/request-renewal
exports.requestRenewal = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const planName = req.body?.planName;

    if (!planName) {
      return res.status(400).json({ success: false, message: 'Please select a membership plan.' });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Upload a payment screenshot — UPI payment proof is required.'
      });
    }

    user.renewalRequested = true;
    user.renewalRequestDate = new Date();
    user.requestedPlanName = String(planName).trim();
    user.renewalPaymentProof = `/uploads/${req.file.filename}`;
    user.renewalRejectionReason = '';
    user.renewalRejectedAt = null;

    if (!user.isActive && !user.membershipOfferSent) {
      user.membershipOfferSent = true;
      user.membershipOfferPlanName = user.requestedPlanName || user.planName || 'Monthly Plan';
      user.membershipOfferSentAt = new Date();
    }

    await user.save();

    emitMembershipRenewalRequest(user);

    res.json({
      success: true,
      message: `Membership renewal request submitted for ${planName}! Super Admin payment verify karke activate karenge.`,
      user: {
        _id: user._id,
        renewalRequested: user.renewalRequested,
        renewalRequestDate: user.renewalRequestDate,
        requestedPlanName: user.requestedPlanName,
        renewalPaymentProof: user.renewalPaymentProof,
        planName: user.planName,
        planStatus: user.planStatus,
        subscriptionEndsAt: user.subscriptionEndsAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Super Admin rejects membership renewal request
// @route PATCH /api/super-admin/admins/:id/reject-renewal
exports.rejectRenewal = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    if (!admin.renewalRequested) {
      return res.status(400).json({ success: false, message: 'This admin has no pending renewal request.' });
    }

    const rejectionReason = reason ? String(reason).trim() : 'Payment could not be verified. Please try again with a valid screenshot.';

    admin.renewalRequested = false;
    admin.renewalRequestDate = null;
    admin.requestedPlanName = '';
    admin.renewalPaymentProof = '';
    admin.renewalRejectionReason = rejectionReason;
    admin.renewalRejectedAt = new Date();

    await admin.save();

    emitMembershipRenewalRejected(admin, rejectionReason);

    res.json({
      success: true,
      message: `Renewal request rejected — ${admin.restaurantName} has been notified.`,
      admin
    });
  } catch (error) {
    next(error);
  }
};
