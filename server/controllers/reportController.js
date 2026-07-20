const Order = require('../models/Order');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');

const buildTenantMatch = (req, extra = {}) => {
  const adminId = getTenantAdminId(req.user);
  if (!adminId) {
    const error = new Error('Tenant access required');
    error.status = 403;
    throw error;
  }
  return { adminId, ...extra };
};

exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = buildTenantMatch(req, { orderStatus: { $ne: 'Cancelled' } });

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const sales = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' },
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    res.json({ success: true, sales });
  } catch (error) {
    next(error);
  }
};

exports.getItemSalesReport = async (req, res, next) => {
  try {
    const matchQuery = buildTenantMatch(req, { orderStatus: { $ne: 'Cancelled' } });

    const items = await Order.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemName',
          size: { $first: '$items.size' },
          quantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { quantitySold: -1 } }
    ]);

    res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

exports.getTableSalesReport = async (req, res, next) => {
  try {
    const matchQuery = buildTenantMatch(req, { orderStatus: { $ne: 'Cancelled' } });

    const tables = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$tableNumber',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({ success: true, tables });
  } catch (error) {
    next(error);
  }
};
