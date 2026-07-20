const express = require('express');
const router = express.Router();
const { getSalesReport, getItemSalesReport, getTableSalesReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/sales', getSalesReport);
router.get('/items', getItemSalesReport);
router.get('/tables', getTableSalesReport);

module.exports = router;
