const express = require('express');
const router = express.Router();
const { getCategories, createCategory, getCategoryById, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', getCategories);
router.post('/', handleUpload('image'), createCategory);
router.get('/:id', getCategoryById);
router.put('/:id', handleUpload('image'), updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
