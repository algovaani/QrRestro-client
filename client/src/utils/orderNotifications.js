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
