const MenuItem = require('../models/MenuItem');
const {
  buildBranchRequiredFilter,
  assertScopedOwnership
} = require('../middleware/tenantMiddleware');
const {
  parseDataUrl,
  getMenuItemPhotoPath,
  normalizeMenuItemImage,
  readUploadedImageData,
  ensureMenuItemImageStored
} = require('../utils/menuImage');

const hydrateMenuItemImages = async (items) => {
  const list = Array.isArray(items) ? items : [items];
  await Promise.all(
    list.map(async (item) => {
      if (!item) return;
      if (
        item.imageData ||
        item.image?.startsWith('/uploads/') ||
        item.image?.startsWith('data:') ||
        (!item.image && item.imageData)
      ) {
        await ensureMenuItemImageStored(item);
      } else if (item.imageData && !String(item.image || '').includes('/photo')) {
        item.image = getMenuItemPhotoPath(item._id);
        await item.save();
      }
    })
  );
  return list;
};

const parseBool = (val, defaultVal = false) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return defaultVal;
};

// @desc Get all menu items for a branch
// @route GET /api/menu?branchId=
exports.getMenuItems = async (req, res, next) => {
  try {
    const filter = buildBranchRequiredFilter(req.user, req, res);
    if (!filter) return;
    
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const items = await MenuItem.find(filter).select('+imageData').populate('category').sort({ createdAt: -1 });
    await hydrateMenuItemImages(items);

    res.json({
      success: true,
      count: items.length,
      items: items.map(normalizeMenuItemImage)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single menu item by ID
// @route GET /api/menu/:id
exports.getMenuItemById = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).select('+imageData').populate('category');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    if (!assertScopedOwnership(item, req.user, res, 'Not authorized to view this menu item')) return;
    await hydrateMenuItemImages(item);
    res.json({
      success: true,
      item: normalizeMenuItemImage(item)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create menu item for logged in admin
// @route POST /api/menu
exports.createMenuItem = async (req, res, next) => {
  try {
    const filter = buildBranchRequiredFilter(req.user, req, res);
    if (!filter) return;

    const { name, category, description, foodType, priceType, halfPrice, fullPrice, fixedPrice, preparationTime, isAvailable, isFeatured, status } = req.body;

    let imageData = '';
    if (req.file) {
      try {
        imageData = readUploadedImageData(req.file);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Image upload failed' });
      }
    }

    const item = await MenuItem.create({
      adminId: filter.adminId,
      branchId: filter.branchId,
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
      image: '',
      imageData: imageData || ''
    });

    if (imageData) {
      item.image = getMenuItemPhotoPath(item._id);
      await item.save();
    }

    res.status(201).json({
      success: true,
      item: normalizeMenuItemImage(item)
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update menu item
// @route PUT /api/menu/:id
exports.updateMenuItem = async (req, res, next) => {
  try {
    let item = await MenuItem.findById(req.params.id).select('+imageData');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    if (!assertScopedOwnership(item, req.user, res, 'Not authorized to modify another restaurant menu item')) return;
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
        item.imageData = readUploadedImageData(req.file);
        item.image = getMenuItemPhotoPath(item._id);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Image upload failed' });
      }
    } else if (parseBool(req.body.removeImage, false)) {
      item.image = '';
      item.imageData = '';
    } else if (req.body.keepExistingImage === 'true' || req.body.keepExistingImage === true) {
      if (item.imageData && (!item.image || item.image.startsWith('/uploads/') || item.image.startsWith('data:'))) {
        item.image = getMenuItemPhotoPath(item._id);
      }
    }

    await item.save();

    res.json({
      success: true,
      item: normalizeMenuItemImage(item)
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

    if (!assertScopedOwnership(item, req.user, res, 'Not authorized to delete another restaurant menu item')) return;

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

    if (!assertScopedOwnership(item, req.user, res, 'Not authorized to modify another restaurant item')) return;

    const nextAvailable = !item.isAvailable;
    await MenuItem.updateOne({ _id: item._id }, { $set: { isAvailable: nextAvailable } });

    res.json({
      success: true,
      isAvailable: nextAvailable
    });
  } catch (error) {
    next(error);
  }
};

// @desc Serve menu item photo (stored in MongoDB)
// @route GET /api/public/menu-item/:id/photo
exports.getMenuItemPhoto = async (req, res, next) => {
  try {
    let item = await MenuItem.findById(req.params.id).select('+imageData image');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    item = await ensureMenuItemImageStored(item);

    let dataUrl = item.imageData;
    if (!dataUrl && item.image?.startsWith('data:')) {
      dataUrl = item.image;
      item.imageData = dataUrl;
      item.image = getMenuItemPhotoPath(item._id);
      await item.save();
    }

    if (!dataUrl) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(404).json({ success: false, message: 'Invalid image data' });
    }

    res.set({
      'Content-Type': parsed.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"menu-photo-${item._id}-${item.updatedAt?.getTime?.() || 0}"`
    });
    res.send(parsed.buffer);
  } catch (error) {
    next(error);
  }
};
