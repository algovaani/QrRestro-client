const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchManager,
  updateBranchFeatures,
  upsertBranchManager,
  deleteBranchManager,
  portalLoginAsBranch
} = require('../controllers/branchController');
const { requirePlanFeature } = require('../middleware/planFeatureMiddleware');

router.use(protect);
router.use(authorize('Admin', 'Kitchen', 'BranchAdmin'));

router.get('/', getBranches);
router.post('/', authorize('Admin'), requirePlanFeature('branches'), createBranch);
router.put('/:id', authorize('Admin'), requirePlanFeature('branches'), updateBranch);
router.delete('/:id', authorize('Admin'), requirePlanFeature('branches'), deleteBranch);
router.put('/:id/features', authorize('Admin'), requirePlanFeature('branches'), updateBranchFeatures);

router.get('/:id/manager', authorize('Admin'), requirePlanFeature('branch_portal'), getBranchManager);
router.put('/:id/manager', authorize('Admin'), requirePlanFeature('branch_portal'), upsertBranchManager);
router.delete('/:id/manager', authorize('Admin'), requirePlanFeature('branch_portal'), deleteBranchManager);
router.post('/:id/portal-login', authorize('Admin'), requirePlanFeature('branch_portal'), portalLoginAsBranch);

module.exports = router;
