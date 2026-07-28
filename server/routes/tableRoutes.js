const express = require('express');
const router = express.Router();
const { getTables, createTable, getTableById, updateTable, deleteTable, regenerateQR, regenerateAllQR } = require('../controllers/tableController');
const { protect } = require('../middleware/authMiddleware');
const { requirePlanFeature } = require('../middleware/planFeatureMiddleware');

router.use(protect);
router.use(requirePlanFeature('tables_qr'));

router.route('/')
  .get(getTables)
  .post(createTable);

router.post('/regenerate-all-qrs', regenerateAllQR);

router.route('/:id')
  .get(getTableById)
  .put(updateTable)
  .delete(deleteTable);

router.post('/:id/regenerate-qr', regenerateQR);

module.exports = router;
