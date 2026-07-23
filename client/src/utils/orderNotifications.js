import { playOrderChime } from './orderChime';

export const normalizeMobile = (mobile) =>
  String(mobile || '').replace(/\D/g, '').slice(-10);

export const mobilesMatch = (a, b) => normalizeMobile(a) === normalizeMobile(b);

export const normalizeTableNumber = (value) => String(value ?? '').trim();

export const tableNumbersMatch = (a, b) =>
  normalizeTableNumber(a) === normalizeTableNumber(b);

/** Order must match this table session — not just the same mobile on another table/branch. */
export const orderMatchesCustomerSession = (order, adminId, tableNumber, customerMobile, branchId = '') => {
  if (!order || !adminId || !tableNumber || !customerMobile) return false;
  if (String(order.adminId) !== String(adminId)) return false;
  if (!tableNumbersMatch(order.tableNumber, tableNumber)) return false;
  if (branchId && order.branchId && String(order.branchId) !== String(branchId)) return false;
  return mobilesMatch(order.customerMobile, customerMobile);
};

const NOTIFY_STATUSES = new Set(['Confirmed', 'Preparing', 'Ready', 'Served', 'Completed']);

export const shouldShowStatusToast = (order, prevStatus) => {
  if (!order?.orderStatus || !prevStatus) return false;
  return prevStatus !== order.orderStatus;
};

/** Sound only for meaningful kitchen/status updates — not payment or settings toasts. */
export const shouldPlaySoundForOrder = (order, prevStatus) => {
  if (!shouldShowStatusToast(order, prevStatus)) return false;
  return NOTIFY_STATUSES.has(order.orderStatus);
};

export const getOrderStatusMessage = (order) => {
  const num = order?.orderNumber || '';
  switch (order?.orderStatus) {
    case 'Confirmed':
      return `✅ Order #${num} confirmed by restaurant!`;
    case 'Preparing':
      return `👨‍🍳 Order #${num} is being prepared in kitchen!`;
    case 'Ready':
      return `🔥 Order #${num} is ready — coming to your table!`;
    case 'Served':
      return `🍽️ Order #${num} served at your table. Enjoy!`;
    case 'Completed':
      return `✅ Order #${num} completed. Thank you!`;
    default:
      return `📋 Order #${num} status: ${order?.orderStatus}`;
  }
};

export const vibrateCustomerAlert = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([120, 60, 120]);
  }
};

const CUSTOMER_ALERT_COOLDOWN_MS = 2500;
const recentCustomerAlerts = new Map();

/** Play chime + vibrate only when a live order status notification is shown. */
export async function playCustomerOrderAlert(order, prevStatus) {
  if (!order || !shouldPlaySoundForOrder(order, prevStatus)) return false;

  const orderId = String(order._id || order.orderNumber || '');
  const key = `${orderId}:${order.orderStatus || ''}`;
  const now = Date.now();
  const last = recentCustomerAlerts.get(key);
  if (last != null && now - last < CUSTOMER_ALERT_COOLDOWN_MS) {
    return false;
  }

  const played = await playOrderChime();
  if (!played) return false;

  recentCustomerAlerts.set(key, now);
  vibrateCustomerAlert();
  return true;
}

/** Show toast + optional sound together for order status updates only. */
export function notifyCustomerOrderStatus(order, setToast, prevStatus) {
  if (!shouldShowStatusToast(order, prevStatus)) return;
  setToast(getOrderStatusMessage(order));
  void playCustomerOrderAlert(order, prevStatus);
}
