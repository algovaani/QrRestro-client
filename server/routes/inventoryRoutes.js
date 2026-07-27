const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { requirePlanFeature } = require('../middleware/planFeatureMiddleware');
const {
  getInventory,
  upsertInventory,
  adjustInventory,
  deleteInventory,
  getInventorySummary
} = require('../controllers/inventoryController');

router.use(protect);
router.use(authorize('Admin', 'BranchAdmin'));
router.use(requirePlanFeature('inventory'));

router.get('/summary', getInventorySummary);
router.get('/', getInventory);
router.post('/', upsertInventory);
router.patch('/:id/adjust', adjustInventory);
router.delete('/:id', deleteInventory);

module.exports = router;
