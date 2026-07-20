const MenuItem = require('../models/MenuItem');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');

// @desc Get all menu items (filtered strictly by logged-in adminId)
// @route GET /api/menu
exports.getMenuItems = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    const filter = adminId ? { adminId } : {};
    
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const items = await MenuItem.find(filter).populate('category').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single menu item by ID
// @route GET /api/menu/:id
exports.getMenuItemById = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate('category');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({
      success: true,
      item
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create menu item for logged in admin
// @route POST /api/menu
exports.createMenuItem = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    const { name, category, description, foodType, priceType, halfPrice, fullPrice, fixedPrice, preparationTime, isAvailable, isFeatured, status } = req.body;

    let image = '';
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    const item = await MenuItem.create({
      adminId,
      name,
      category,
      description,
      foodType,
      priceType,
      halfPrice: halfPrice || 0,
      fullPrice: fullPrice || 0,
      fixedPrice: fixedPrice || 0,
      preparationTime: preparationTime || 15,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      isFeatured: isFeatured !== undefined ? isFeatured : false,
      status: status || 'Active',
      image
    });

    res.status(201).json({
      success: true,
      item
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update menu item
// @route PUT /api/menu/:id
exports.updateMenuItem = async (req, res, next) => {
  try {
    let item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && item.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify another restaurant menu item' });
    }

    const fieldsToUpdate = [
      'name', 'category', 'description', 'foodType', 'priceType',
      'halfPrice', 'fullPrice', 'fixedPrice', 'preparationTime',
      'isAvailable', 'isFeatured', 'status'
    ];

    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    });

    if (req.file) {
      item.image = `/uploads/${req.file.filename}`;
    }

    await item.save();

    res.json({
      success: true,
      item
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete menu item
// @route DELETE /api/menu/:id
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && item.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete another restaurant menu item' });
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Toggle item availability
// @route PATCH /api/menu/:id/toggle-availability
exports.toggleAvailability = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const adminId = getTenantAdminId(req.user);
    if (adminId && item.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify another restaurant item' });
    }

    item.isAvailable = !item.isAvailable;
    await item.save();

    res.json({
      success: true,
      isAvailable: item.isAvailable
    });
  } catch (error) {
    next(error);
  }
};
