const MenuItem = require('../models/MenuItem');

exports.getMenuItems = async (req, res, next) => {
  try {
    const { search, category, foodType, isAvailable, status } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) query.category = category;
    if (foodType) query.foodType = foodType;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (status) query.status = status;

    const menuItems = await MenuItem.find(query)
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: menuItems.length, menuItems });
  } catch (error) {
    next(error);
  }
};

exports.createMenuItem = async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      foodType,
      priceType,
      halfPrice,
      fullPrice,
      fixedPrice,
      preparationTime,
      isAvailable,
      isFeatured,
      status
    } = req.body;

    let image = '';
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    const menuItem = await MenuItem.create({
      name,
      category,
      description: description || '',
      foodType: foodType || 'Veg',
      priceType: priceType || 'Single Fixed Price',
      halfPrice: halfPrice ? parseFloat(halfPrice) : 0,
      fullPrice: fullPrice ? parseFloat(fullPrice) : 0,
      fixedPrice: fixedPrice ? parseFloat(fixedPrice) : 0,
      preparationTime: preparationTime ? parseInt(preparationTime) : 15,
      isAvailable: isAvailable !== undefined ? (isAvailable === 'true' || isAvailable === true) : true,
      isFeatured: isFeatured !== undefined ? (isFeatured === 'true' || isFeatured === true) : false,
      status: status || 'Active',
      image
    });

    const populatedItem = await MenuItem.findById(menuItem._id).populate('category', 'name');

    res.status(201).json({ success: true, menuItem: populatedItem });
  } catch (error) {
    next(error);
  }
};

exports.getMenuItemById = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).populate('category', 'name');
    if (!menuItem) return res.status(404).json({ success: false, message: 'Menu item not found' });
    res.json({ success: true, menuItem });
  } catch (error) {
    next(error);
  }
};

exports.updateMenuItem = async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      foodType,
      priceType,
      halfPrice,
      fullPrice,
      fixedPrice,
      preparationTime,
      isAvailable,
      isFeatured,
      status
    } = req.body;

    let menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) return res.status(404).json({ success: false, message: 'Menu item not found' });

    if (name) menuItem.name = name;
    if (category) menuItem.category = category;
    if (description !== undefined) menuItem.description = description;
    if (foodType) menuItem.foodType = foodType;
    if (priceType) menuItem.priceType = priceType;
    if (halfPrice !== undefined) menuItem.halfPrice = parseFloat(halfPrice);
    if (fullPrice !== undefined) menuItem.fullPrice = parseFloat(fullPrice);
    if (fixedPrice !== undefined) menuItem.fixedPrice = parseFloat(fixedPrice);
    if (preparationTime !== undefined) menuItem.preparationTime = parseInt(preparationTime);
    if (isAvailable !== undefined) menuItem.isAvailable = (isAvailable === 'true' || isAvailable === true);
    if (isFeatured !== undefined) menuItem.isFeatured = (isFeatured === 'true' || isFeatured === true);
    if (status) menuItem.status = status;

    if (req.file) {
      menuItem.image = `/uploads/${req.file.filename}`;
    }

    await menuItem.save();
    const updated = await MenuItem.findById(menuItem._id).populate('category', 'name');

    res.json({ success: true, menuItem: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) return res.status(404).json({ success: false, message: 'Menu item not found' });

    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.toggleAvailability = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) return res.status(404).json({ success: false, message: 'Menu item not found' });

    menuItem.isAvailable = !menuItem.isAvailable;
    await menuItem.save();

    res.json({ success: true, isAvailable: menuItem.isAvailable, message: `Item marked as ${menuItem.isAvailable ? 'Available' : 'Unavailable'}` });
  } catch (error) {
    next(error);
  }
};
