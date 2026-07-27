const Branch = require('../models/Branch');

const toPlainOrder = (order) => (order?.toObject ? order.toObject() : { ...order });

/** Fill missing branchName on orders from Branch collection (legacy orders). */
async function enrichOrdersWithBranchNames(orders) {
  if (!orders?.length) return [];

  const plain = orders.map(toPlainOrder);
  const missingBranchIds = [
    ...new Set(
      plain
        .filter((o) => o.branchId && !String(o.branchName || '').trim())
        .map((o) => String(o.branchId))
    )
  ];

  if (!missingBranchIds.length) return plain;

  const branches = await Branch.find({ _id: { $in: missingBranchIds } }).select('branchName');
  const nameById = Object.fromEntries(branches.map((b) => [String(b._id), b.branchName || '']));

  return plain.map((order) => {
    if (order.branchId && !String(order.branchName || '').trim()) {
      order.branchName = nameById[String(order.branchId)] || '';
    }
    return order;
  });
}

module.exports = { enrichOrdersWithBranchNames };
