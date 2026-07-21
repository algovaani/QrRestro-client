const express = require('express');
const router = express.Router();
const { getMenuItems, createMenuItem, getMenuItemById, updateMenuItem, deleteMenuItem, toggleAvailability } = require('../controllers/menuItemController');
const { protect } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', getMenuItems);
router.post('/', handleUpload('image'), createMenuItem);
router.get('/:id', getMenuItemById);
router.put('/:id', handleUpload('image'), updateMenuItem);
router.delete('/:id', deleteMenuItem);
router.patch('/:id/availability', toggleAvailability);

module.exports = router;
