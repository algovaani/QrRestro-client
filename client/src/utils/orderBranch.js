/** Resolve display name for an order's branch (saved name or lookup by branchId). */
export function resolveOrderBranchName(order, getBranchName) {
  if (!order) return '';
  const saved = String(order.branchName || '').trim();
  if (saved) return saved;
  const resolved = getBranchName?.(order.branchId);
  if (resolved) return resolved;
  return order.branchId ? 'Branch' : '';
}

export function formatOrderTableLabel(order, getBranchName, { includeBranch = true } = {}) {
  const table = `Table ${order?.tableNumber ?? '—'}`;
  if (!includeBranch) return table;
  const branch = resolveOrderBranchName(order, getBranchName);
  return branch ? `${table} · ${branch}` : table;
}

export function buildNewOrderNotificationMessage(order, getBranchName) {
  if (!order) return '';
  const branch = resolveOrderBranchName(order, getBranchName);
  const branchPart = branch ? ` · ${branch}` : '';
  return `Order #${order.orderNumber} · Table ${order.tableNumber}${branchPart} (₹${order.grandTotal})`;
}

export function formatAdminNotificationMessage(notification, getBranchName) {
  const order = notification?.order;
  if (!order) return notification?.message || '';

  const branch = resolveOrderBranchName(order, getBranchName);
  const branchPart = branch ? ` · ${branch}` : '';

  switch (notification.type) {
    case 'new_order':
      return `Order #${order.orderNumber} · Table ${order.tableNumber}${branchPart} (₹${order.grandTotal})`;
    case 'payment_pending':
      return `Table ${order.tableNumber}${branchPart} submitted ₹${order.grandTotal} for Order #${order.orderNumber}${order.transactionId ? ` (TXN: ${order.transactionId})` : ''}`;
    case 'payment':
      return `Table ${order.tableNumber}${branchPart} paid ₹${order.grandTotal} for Order #${order.orderNumber}`;
    case 'order_rating': {
      const reviewNote = order.review ? ` — "${order.review}"` : '';
      return `Order #${order.orderNumber}${branchPart} rated ${order.rating}/5${reviewNote}`;
    }
    default:
      return notification.message || '';
  }
}
