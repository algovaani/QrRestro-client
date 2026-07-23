const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { requirePlanFeature } = require('../middleware/planFeatureMiddleware');
const {
  getInventory,
  getUntrackedMenuItems,
  upsertInventory,
  adjustInventory,
  initBranchInventory,
  deleteInventory,
  getInventorySummary
} = require('../controllers/inventoryController');

router.use(protect);
router.use(authorize('Admin'));
router.use(requirePlanFeature('inventory'));

router.get('/summary', getInventorySummary);
router.get('/untracked', getUntrackedMenuItems);
router.get('/', getInventory);
router.post('/', upsertInventory);
router.post('/init-branch', initBranchInventory);
router.patch('/:id/adjust', adjustInventory);
router.delete('/:id', deleteInventory);

module.exports = router;
