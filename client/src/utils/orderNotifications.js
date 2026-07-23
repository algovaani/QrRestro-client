import { playOrderChime, markChimeNeedsUnlock } from './orderChime';

export const normalizeMobile = (mobile) =>
  String(mobile || '').replace(/\D/g, '').slice(-10);

export const mobilesMatch = (a, b) => normalizeMobile(a) === normalizeMobile(b);

export const normalizeTableNumber = (value) => String(value ?? '').trim();

export const tableNumbersMatch = (a, b) =>
  normalizeTableNumber(a) === normalizeTableNumber(b);

/** Order must match this table session — not just the same mobile on another table. */
export const orderMatchesCustomerSession = (order, adminId, tableNumber, customerMobile) => {
  if (!order || !adminId || !tableNumber || !customerMobile) return false;
  if (String(order.adminId) !== String(adminId)) return false;
  if (!tableNumbersMatch(order.tableNumber, tableNumber)) return false;
  return mobilesMatch(order.customerMobile, customerMobile);
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

/** Prevent duplicate chime/vibrate for the same order update (socket + poll). */
export async function playCustomerOrderAlert(order) {
  if (!order) return false;

  const orderId = String(order._id || order.orderNumber || '');
  const key = `${orderId}:${order.orderStatus || ''}:${order.paymentStatus || ''}`;
  const now = Date.now();
  const last = recentCustomerAlerts.get(key);
  if (last != null && now - last < CUSTOMER_ALERT_COOLDOWN_MS) {
    return false;
  }

  const played = await playOrderChime();
  if (!played) {
    markChimeNeedsUnlock();
    return false;
  }

  recentCustomerAlerts.set(key, now);
  vibrateCustomerAlert();
  return true;
}
