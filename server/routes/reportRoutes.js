const express = require('express');
const router = express.Router();
const { getSalesReport, getItemSalesReport, getTableSalesReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { requirePlanFeature } = require('../middleware/planFeatureMiddleware');

router.use(protect);
router.use(requirePlanFeature('reports'));

router.get('/sales', getSalesReport);
router.get('/items', getItemSalesReport);
router.get('/tables', getTableSalesReport);

module.exports = router;
