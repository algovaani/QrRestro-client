const Category = require('../models/Category');
const {
  getTenantAdminId,
  buildBranchRequiredFilter,
  assertScopedOwnership
} = require('../middleware/tenantMiddleware');
const { persistUploadedImage } = require('../utils/persistUpload');

// @desc Get all categories for a branch
// @route GET /api/categories?branchId=
exports.getCategories = async (req, res, next) => {
  try {
    const filter = buildBranchRequiredFilter(req.user, req, res);
    if (!filter) return;

    const categories = await Category.find(filter).sort({ displayOrder: 1 });
    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single category by ID
// @route GET /api/categories/:id
exports.getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (!assertScopedOwnership(category, req.user, res, 'Not authorized to view this category')) return;

    res.json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create category for a branch
// @route POST /api/categories?branchId=
exports.createCategory = async (req, res, next) => {
  try {
    const filter = buildBranchRequiredFilter(req.user, req, res);
    if (!filter) return;

    const { name, description, displayOrder, status } = req.body;
    let image = '';

    if (req.file) {
      image = persistUploadedImage(req.file);
    }

    const category = await Category.create({
      adminId: filter.adminId,
      branchId: filter.branchId,
      name,
      image,
      description,
      displayOrder: displayOrder || 0,
      status: status || 'Active'
    });

    res.status(201).json({
      success: true,
      category
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'A category with this name already exists in this branch' });
    }
    next(error);
  }
};

// @desc Update category
// @route PUT /api/categories/:id
exports.updateCategory = async (req, res, next) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (!assertScopedOwnership(category, req.user, res, 'Not authorized to modify another restaurant data')) return;

    const { name, description, displayOrder, status } = req.body;

    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (status) category.status = status;

    if (req.file) {
      category.image = persistUploadedImage(req.file);
    }

    await category.save();

    res.json({
      success: true,
      category
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'A category with this name already exists in this branch' });
    }
    next(error);
  }
};

// @desc Delete category
// @route DELETE /api/categories/:id
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (!assertScopedOwnership(category, req.user, res, 'Not authorized to delete another restaurant data')) return;

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
