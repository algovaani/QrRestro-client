import { playOrderChime } from './orderChime';

export const normalizeMobile = (mobile) =>
  String(mobile || '').replace(/\D/g, '').slice(-10);

export const mobilesMatch = (a, b) => normalizeMobile(a) === normalizeMobile(b);

export const normalizeTableNumber = (value) => String(value ?? '').trim();

export const tableNumbersMatch = (a, b) =>
  normalizeTableNumber(a) === normalizeTableNumber(b);

export const normalizeBranchId = (value) => (value ? String(value) : '');

/** Order must match this table session — scoped by branch when branch is known. */
export const orderMatchesCustomerSession = (order, adminId, tableNumber, customerMobile, branchId = '') => {
  if (!order || !adminId || !tableNumber) return false;
  if (String(order.adminId) !== String(adminId)) return false;
  if (!tableNumbersMatch(order.tableNumber, tableNumber)) return false;

  const sessionBranch = normalizeBranchId(branchId);
  const orderBranch = normalizeBranchId(order.branchId);
  if (sessionBranch) {
    if (!orderBranch || orderBranch !== sessionBranch) return false;
  }

  const sessionMobile = customerMobile || order.customerMobile;
  if (!sessionMobile || !order.customerMobile) return false;
  return mobilesMatch(order.customerMobile, sessionMobile);
};

const NOTIFY_STATUSES = new Set(['Confirmed', 'Preparing', 'Ready', 'Served', 'Completed']);

export const shouldShowStatusToast = (order, prevStatus) => {
  if (!order?.orderStatus) return false;
  if (!prevStatus) return order.orderStatus !== 'New';
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

export const getPaymentPendingMessage = (order) =>
  `⏳ Payment submitted for Order #${order?.orderNumber || ''} — waiting for admin approval`;

export const getPaymentSuccessMessage = (order) =>
  `💳 Payment approved for Order #${order?.orderNumber || ''}!`;

export const getPaymentRejectedMessage = (order) =>
  `Payment for Order #${order?.orderNumber || ''} was not approved. Please try again.`;

export const vibrateCustomerAlert = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([120, 60, 120]);
  }
};

const CUSTOMER_ALERT_COOLDOWN_MS = 2500;
const CUSTOMER_TOAST_COOLDOWN_MS = 3000;
const recentCustomerAlerts = new Map();
const recentCustomerToasts = new Map();

const shouldSkipDuplicateToast = (key) => {
  const now = Date.now();
  const last = recentCustomerToasts.get(key);
  if (last != null && now - last < CUSTOMER_TOAST_COOLDOWN_MS) return true;
  recentCustomerToasts.set(key, now);
  return false;
};

/** Show toast once — skips duplicate socket + polling updates within a few seconds. */
export function showCustomerToast(message, setToast, dedupeKey) {
  if (!message || !setToast) return;
  if (dedupeKey && shouldSkipDuplicateToast(dedupeKey)) return;
  setToast(message);
}

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
  const message = getOrderStatusMessage(order);
  const dedupeKey = `status:${order._id || order.orderNumber}:${order.orderStatus}`;
  if (shouldSkipDuplicateToast(dedupeKey)) return;
  setToast(message);
  void playCustomerOrderAlert(order, prevStatus);
}

export function notifyCustomerPaymentPending(order, setToast) {
  showCustomerToast(getPaymentPendingMessage(order), setToast, `pay-pending:${order._id || order.orderNumber}`);
}

export function notifyCustomerPaymentSuccess(order, setToast) {
  showCustomerToast(getPaymentSuccessMessage(order), setToast, `pay-success:${order._id || order.orderNumber}`);
}

export function notifyCustomerPaymentRejected(order, setToast) {
  showCustomerToast(getPaymentRejectedMessage(order), setToast, `pay-reject:${order._id || order.orderNumber}`);
}
