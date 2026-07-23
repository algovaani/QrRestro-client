export const normalizeMobile = (mobile) =>
  String(mobile || '').replace(/\D/g, '').slice(-10);

export const mobilesMatch = (a, b) => normalizeMobile(a) === normalizeMobile(b);

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

const CUSTOMER_ALERT_COOLDOWN_MS = 3000;
const recentCustomerAlerts = new Map();

/** Prevent duplicate chime/vibrate for the same order update (socket + poll, or menu + modal). */
export function playCustomerOrderAlert(order, playOrderChime) {
  if (!order || typeof playOrderChime !== 'function') return false;

  const orderId = String(order._id || order.orderNumber || '');
  const key = `${orderId}:${order.orderStatus || ''}:${order.paymentStatus || ''}`;
  const now = Date.now();
  const last = recentCustomerAlerts.get(key);
  if (last != null && now - last < CUSTOMER_ALERT_COOLDOWN_MS) {
    return false;
  }
  recentCustomerAlerts.set(key, now);

  playOrderChime();
  vibrateCustomerAlert();
  return true;
}
