const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchManager,
  upsertBranchManager,
  deleteBranchManager
} = require('../controllers/branchController');

router.use(protect);
router.use(authorize('Admin', 'Kitchen', 'BranchAdmin'));

router.get('/', getBranches);
router.post('/', authorize('Admin'), createBranch);
router.put('/:id', authorize('Admin'), updateBranch);
router.delete('/:id', authorize('Admin'), deleteBranch);

router.get('/:id/manager', authorize('Admin'), getBranchManager);
router.put('/:id/manager', authorize('Admin'), upsertBranchManager);
router.delete('/:id/manager', authorize('Admin'), deleteBranchManager);

module.exports = router;
