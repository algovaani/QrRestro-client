const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');

// @desc Get Admin Dashboard Analytics Stats
// @route GET /api/dashboard/stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }
    const adminFilter = { adminId };

    let dateFilter = {};
    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end
        }
      };
    }

    const queryFilter = { ...adminFilter, ...dateFilter };

    const revenueAgg = await Order.aggregate([
      { $match: { ...queryFilter, paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    const totalOrders = await Order.countDocuments(queryFilter);

    const pendingOrders = await Order.countDocuments({
      ...queryFilter,
      orderStatus: { $in: ['New', 'Confirmed', 'Preparing'] }
    });

    const preparingOrders = await Order.countDocuments({
      ...queryFilter,
      orderStatus: 'Preparing'
    });

    const completedOrders = await Order.countDocuments({
      ...queryFilter,
      orderStatus: 'Completed'
    });

    const totalTables = await Table.countDocuments(adminFilter);
    const totalMenuItems = await MenuItem.countDocuments(adminFilter);
    const totalCategories = await Category.countDocuments(adminFilter);

    const recentOrders = await Order.find(queryFilter)
      .sort({ createdAt: -1 })
      .limit(5);

    const topItemsAgg = await Order.aggregate([
      { $match: queryFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemName',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      stats: {
        totalRevenue,
        todayRevenue: totalRevenue,
        totalOrders,
        todayOrders: totalOrders,
        pendingOrders,
        preparingOrders,
        completedOrders,
        totalTables,
        totalMenuItems,
        totalCategories
      },
      recentOrders,
      topSellingItems: topItemsAgg
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get Recent Orders
// @route GET /api/dashboard/recent-orders
exports.getRecentOrders = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }
    const adminFilter = { adminId };

    let dateFilter = {};
    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end
        }
      };
    }

    const recentOrders = await Order.find({ ...adminFilter, ...dateFilter })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, recentOrders });
  } catch (error) {
    next(error);
  }
};

// @desc Get Top Selling Items
// @route GET /api/dashboard/top-items
exports.getTopItems = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant admin access required' });
    }
    const adminFilter = { adminId };
    const topItemsAgg = await Order.aggregate([
      { $match: adminFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemName',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);
    res.json({ success: true, topSellingItems: topItemsAgg });
  } catch (error) {
    next(error);
  }
};
