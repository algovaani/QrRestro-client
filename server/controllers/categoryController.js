const Category = require('../models/Category');
const { getTenantAdminId, buildTenantFilter, assertTenantOwnership } = require('../middleware/tenantMiddleware');
const { persistUploadedImage } = require('../utils/persistUpload');

// @desc Get all categories (filtered strictly by logged-in adminId)
// @route GET /api/categories
exports.getCategories = async (req, res, next) => {
  try {
    const filter = buildTenantFilter(req.user, res);
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
    res.json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create category for logged-in Restaurant Admin
// @route POST /api/categories
exports.createCategory = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }
    const { name, description, displayOrder, status } = req.body;
    let image = '';

    if (req.file) {
      image = persistUploadedImage(req.file);
    }

    const category = await Category.create({
      adminId,
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

    const adminId = getTenantAdminId(req.user);
    if (adminId && category.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify another restaurant data' });
    }

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

    const adminId = getTenantAdminId(req.user);
    if (adminId && category.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete another restaurant data' });
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
