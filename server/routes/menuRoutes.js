const express = require('express');
const router = express.Router();
const { getMenuItems, createMenuItem, getMenuItemById, updateMenuItem, deleteMenuItem, toggleAvailability } = require('../controllers/menuItemController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', getMenuItems);
router.post('/', upload.single('image'), createMenuItem);
router.get('/:id', getMenuItemById);
router.put('/:id', upload.single('image'), updateMenuItem);
router.delete('/:id', deleteMenuItem);
router.patch('/:id/availability', toggleAvailability);

module.exports = router;
