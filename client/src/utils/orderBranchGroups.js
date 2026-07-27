const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isSameCalendarDay = (a, b) =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

export function getOrderDayBucket(createdAt) {
  if (!createdAt) return 'older';
  const orderDate = new Date(createdAt);
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameCalendarDay(orderDate, today)) return 'today';
  if (isSameCalendarDay(orderDate, yesterday)) return 'yesterday';
  return 'older';
}

export function computeOrderDayStats(orders = []) {
  const stats = {
    today: { count: 0, revenue: 0 },
    yesterday: { count: 0, revenue: 0 },
    total: { count: 0, revenue: 0 }
  };

  orders.forEach((order) => {
    const amount = Number(order.grandTotal) || 0;
    stats.total.count += 1;
    stats.total.revenue += amount;

    const bucket = getOrderDayBucket(order.createdAt);
    if (bucket === 'today') {
      stats.today.count += 1;
      stats.today.revenue += amount;
    } else if (bucket === 'yesterday') {
      stats.yesterday.count += 1;
      stats.yesterday.revenue += amount;
    }
  });

  return stats;
}

export function filterOrdersByDay(orders = [], dayFilter = 'all') {
  if (dayFilter === 'all') return orders;
  return orders.filter((order) => getOrderDayBucket(order.createdAt) === dayFilter);
}

export function buildBranchOrderGroups(orders = [], branches = [], getBranchName, resolveName) {
  const groups = new Map();

  branches.forEach((branch) => {
    groups.set(String(branch._id), {
      branchId: String(branch._id),
      branchName: branch.branchName || 'Branch',
      orders: []
    });
  });

  const unassigned = {
    branchId: 'unassigned',
    branchName: 'Unassigned Branch',
    orders: []
  };

  orders.forEach((order) => {
    const branchId = order.branchId ? String(order.branchId) : '';
    const branchName = resolveName ? resolveName(order) : getBranchName?.(branchId) || order.branchName || '';

    if (branchId && groups.has(branchId)) {
      groups.get(branchId).orders.push(order);
      return;
    }

    if (branchId && !groups.has(branchId)) {
      groups.set(branchId, {
        branchId,
        branchName: branchName || 'Branch',
        orders: [order]
      });
      return;
    }

    unassigned.orders.push(order);
  });

  const list = Array.from(groups.values()).sort((a, b) =>
    a.branchName.localeCompare(b.branchName)
  );

  if (unassigned.orders.length > 0) {
    list.push(unassigned);
  }

  return list.map((group) => ({
    ...group,
    stats: computeOrderDayStats(group.orders)
  }));
}
