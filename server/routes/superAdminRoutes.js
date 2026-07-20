const express = require('express');
const router = express.Router();
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
  deleteAdmin,
  requestRenewal
} = require('../controllers/superAdminController');

const {
  getAllPlans,
  createPlan,
  updatePlan,
  deletePlan
} = require('../controllers/membershipPlanController');

// Restaurant Admin — renewal even when plan expired
router.post('/request-renewal', protectAllowExpired, requestRenewal);

// Super Admin Only Protected Routes
router.use(protect, isSuperAdmin);

// Stats & Admin Accounts
router.get('/stats', getSuperAdminStats);
router.get('/admins', getAllAdmins);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.patch('/admins/:id/toggle-status', toggleAdminStatus);
router.patch('/admins/:id/renew', renewAdminMembership);
router.patch('/admins/:id/reactivate', reactivateAdminMembership);
router.patch('/admins/:id/send-membership-offer', sendMembershipOffer);
router.delete('/admins/:id', deleteAdmin);

// Membership Plans Management Routes
router.get('/plans', getAllPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

module.exports = router;
