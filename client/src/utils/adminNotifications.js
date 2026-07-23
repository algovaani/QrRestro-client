export function getAdminOrderDetailsPath(order, user) {
  const base = user?.role === 'BranchAdmin' ? '/branch' : '/admin';
  if (!order?.orderNumber) return `${base}/orders`;
  return `${base}/orders?order=${encodeURIComponent(order.orderNumber)}`;
}

export function getNotificationCardClass(type) {
  if (type === 'payment') return 'payment';
  if (type === 'payment_pending') return 'payment-pending';
  if (type === 'order_rating') return 'order-rating';
  if (
    type === 'membership_activated' ||
    type === 'membership_renewal_request' ||
    type === 'membership_offer_sent' ||
    type === 'membership_renewal_rejected'
  ) {
    return 'membership';
  }
  return 'order';
}

export function getNotificationActionLabel(notification) {
  if (notification?.order) {
    if (notification.type === 'order_rating') return 'View Rating & Order';
    return 'View Order Details';
  }

  switch (notification?.type) {
    case 'membership_renewal_request':
      return 'View Requests';
    case 'membership_offer_sent':
      return 'View Membership';
    case 'membership_renewal_rejected':
      return 'Retry Membership';
    default:
      return 'Open Dashboard';
  }
}
