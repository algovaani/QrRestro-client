const express = require('express');
const router = express.Router();
const { handleUpload } = require('../middleware/uploadMiddleware');
const { protect, protectAllowExpired, isSuperAdmin } = require('../middleware/authMiddleware');
const {
  getSuperAdminStats,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  renewAdminMembership,
  reactivateAdminMembership,
  sendMembershipOffer,
  rejectRenewal,
  deleteAdmin,
  requestRenewal
} = require('../controllers/superAdminController');

const {
  getAllPlans,
  createPlan,
  updatePlan,
  deletePlan
} = require('../controllers/membershipPlanController');

const { getPlanFeatureCatalogHandler } = require('../utils/planFeatures');
const {
  getPlatformSettings,
  updatePlatformSettings
} = require('../controllers/platformSettingsController');

// Restaurant Admin — renewal even when plan expired (with optional payment screenshot)
router.post('/request-renewal', protectAllowExpired, handleUpload('paymentProof'), requestRenewal);

// Super Admin Only Protected Routes
router.use(protect, isSuperAdmin);

// Stats & Admin Accounts
router.get('/stats', getSuperAdminStats);
router.get('/admins', getAllAdmins);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.patch('/admins/:id/toggle-status', toggleAdminStatus);
router.patch('/admins/:id/renew', renewAdminMembership);
router.patch('/admins/:id/reject-renewal', rejectRenewal);
router.patch('/admins/:id/reactivate', reactivateAdminMembership);
router.patch('/admins/:id/send-membership-offer', sendMembershipOffer);
router.delete('/admins/:id', deleteAdmin);

// Membership Plans Management Routes
router.get('/plan-feature-catalog', getPlanFeatureCatalogHandler);
router.get('/plans', getAllPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Platform settings
router.get('/platform-settings', getPlatformSettings);
router.put('/platform-settings', updatePlatformSettings);

module.exports = router;
