const express = require('express');
const router = express.Router();
const { getPublicMembershipPlans } = require('../controllers/membershipPlanController');
const {
  getTableInfo,
  getPublicMenu,
  getPublicMenuByAdmin,
  placeOrder,
  getOrderStatus,
  getActiveOrdersForTable,
  getActiveOrdersForTableByAdmin,
  submitOrderRating,
  getOrderBillLink,
  getOrderBillPdf
} = require('../controllers/publicController');
const { getMenuItemPhoto } = require('../controllers/menuItemController');

router.get('/membership-plans', getPublicMembershipPlans);
router.get('/menu-item/:id/photo', getMenuItemPhoto);
router.get('/menu/:adminId/table/:tableNumber', getPublicMenuByAdmin);
router.get('/table/:adminId/:tableNumber', getPublicMenuByAdmin);
router.get('/table/:tableNumber', getTableInfo);
router.get('/menu/:tableNumber', getPublicMenu);
router.post('/orders', placeOrder);
router.get('/orders/:orderNumber/status', getOrderStatus);
router.get('/orders/:orderNumber/bill-link', getOrderBillLink);
router.get('/orders/:orderNumber/bill.pdf', getOrderBillPdf);
router.get('/orders/:orderNumber/bill', getOrderBillPdf);
router.get('/orders/table/:adminId/:tableNumber/active', getActiveOrdersForTableByAdmin);
router.get('/orders/table/:tableNumber/active', getActiveOrdersForTable);
router.post('/orders/:orderNumber/rate', submitOrderRating);

module.exports = router;
