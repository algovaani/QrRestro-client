const MenuItem = require('../models/MenuItem');
const { getTenantAdminId, buildTenantFilter, assertTenantOwnership } = require('../middleware/tenantMiddleware');
const { persistUploadedImage } = require('../utils/persistUpload');

const parseBool = (val, defaultVal = false) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return defaultVal;
};

// @desc Get all menu items (filtered strictly by logged-in adminId)
// @route GET /api/menu
exports.getMenuItems = async (req, res, next) => {
  try {
    const filter = buildTenantFilter(req.user, res);
    if (!filter) return;
    
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
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }
    const { name, category, description, foodType, priceType, halfPrice, fullPrice, fixedPrice, preparationTime, isAvailable, isFeatured, status } = req.body;

    let image = '';
    if (req.file) {
      try {
        image = persistUploadedImage(req.file);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Image upload failed' });
      }
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
      isAvailable: parseBool(isAvailable, true),
      isFeatured: parseBool(isFeatured, false),
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
        if (field === 'isAvailable' || field === 'isFeatured') {
          item[field] = parseBool(req.body[field], item[field]);
        } else {
          item[field] = req.body[field];
        }
      }
    });

    if (req.file) {
      try {
        item.image = persistUploadedImage(req.file);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Image upload failed' });
      }
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
