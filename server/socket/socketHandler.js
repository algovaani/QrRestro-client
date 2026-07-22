let ioInstance = null;
const { getDaysRemaining, formatExpiryDate } = require('../utils/membershipDays');

const toPayload = (order) => (order?.toObject ? order.toObject() : order);

const getAdminRoom = (adminId) => `admin_${adminId}`;
const getKitchenRoom = (adminId) => `kitchen_${adminId}`;
const getTableRoom = (adminId, tableNumber) => `table_${adminId}_${String(tableNumber)}`;
const getRestaurantRoom = (adminId) => `restaurant_${adminId}`;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

const emitToTenant = (order, eventName) => {
  if (!ioInstance || !order?.adminId) return;
  const payload = toPayload(order);
  const adminId = String(payload.adminId);

  // Chain rooms so each socket receives the event once (even if in multiple rooms)
  ioInstance
    .to(getAdminRoom(adminId))
    .to(getKitchenRoom(adminId))
    .to(getTableRoom(adminId, payload.tableNumber))
    .emit(eventName, payload);
};

const emitNewOrder = (order) => {
  if (!ioInstance || !order?.adminId) {
    console.warn('emitNewOrder skipped: socket not ready or missing adminId');
    return;
  }
  const payload = toPayload(order);
  console.log(`Emitting new_order to admin_${String(payload.adminId)} — ${payload.orderNumber}`);
  emitToTenant(order, 'new_order');
};
const emitOrderStatusUpdate = (order) => emitToTenant(order, 'order_status_update');
const emitPaymentPending = (order) => emitToTenant(order, 'payment_pending');
const emitPaymentSuccess = (order) => emitToTenant(order, 'payment_success');
const emitOrderRating = (order) => emitToTenant(order, 'order_rating');

const emitMembershipRenewalRequest = (admin) => {
  if (!ioInstance || !admin?._id) return;
  const payload = {
    adminId: String(admin._id),
    restaurantName: admin.restaurantName,
    adminName: admin.name,
    email: admin.email,
    planName: admin.planName,
    requestedPlanName: admin.requestedPlanName || '',
    renewalRequestDate: admin.renewalRequestDate,
    renewalPaymentProof: admin.renewalPaymentProof || ''
  };
  console.log(`Emitting membership_renewal_request for ${payload.restaurantName} to super_admin room`);
  ioInstance.to('super_admin').emit('membership_renewal_request', payload);
};

const emitMembershipRenewalRejected = (admin, reason) => {
  if (!ioInstance || !admin?._id) return;
  const payload = {
    adminId: String(admin._id),
    renewalRequested: false,
    requestedPlanName: '',
    renewalRejectionReason: reason || '',
    renewalRejectedAt: admin.renewalRejectedAt,
    message: reason || 'Your membership request was rejected. Please try again with a valid payment screenshot.'
  };
  ioInstance.to(getAdminRoom(String(admin._id))).emit('membership_renewal_rejected', payload);
};

const emitMembershipActivated = (admin) => {
  if (!ioInstance || !admin?._id) return;
  const expiry = admin.subscriptionEndsAt || admin.trialEndsAt;
  const daysLeft = getDaysRemaining(expiry);
  const payload = {
    adminId: String(admin._id),
    planName: admin.planName,
    planStatus: admin.planStatus,
    subscriptionEndsAt: expiry,
    daysRemaining: daysLeft,
    renewalRequested: false,
    requestedPlanName: '',
    membershipOfferSent: false,
    membershipOfferPlanName: '',
    isExpired: false,
    isActive: admin.isActive,
    message: `Membership activated! ${admin.planName} — ${daysLeft} days remaining (until ${formatExpiryDate(expiry)})`
  };
  ioInstance.to(getAdminRoom(String(admin._id))).emit('membership_activated', payload);
};

const emitMembershipOfferSent = (admin) => {
  if (!ioInstance || !admin?._id) return;
  const payload = {
    adminId: String(admin._id),
    membershipOfferSent: true,
    membershipOfferPlanName: admin.membershipOfferPlanName || '',
    membershipOfferSentAt: admin.membershipOfferSentAt,
    message: admin.membershipOfferPlanName
      ? `Super Admin sent a "${admin.membershipOfferPlanName}" membership offer. You can renew now.`
      : 'Super Admin sent a membership renewal offer.'
  };
  ioInstance.to(getAdminRoom(String(admin._id))).emit('membership_offer_sent', payload);
};

const emitAdminStatusChanged = (admin) => {
  if (!ioInstance || !admin?._id) return;
  const payload = {
    adminId: String(admin._id),
    isActive: admin.isActive,
    membershipOfferSent: Boolean(admin.membershipOfferSent),
    membershipOfferPlanName: admin.membershipOfferPlanName || '',
    renewalRequested: Boolean(admin.renewalRequested),
    requestedPlanName: admin.requestedPlanName || '',
    message: admin.isActive
      ? 'Super Admin has activated your account.'
      : `Your account has been deactivated. Renew your membership${admin.membershipOfferPlanName ? ` — ${admin.membershipOfferPlanName} plan is available` : ''}.`
  };
  ioInstance.to(getAdminRoom(String(admin._id))).emit('admin_status_changed', payload);
};

const emitSettingsUpdated = (adminId, setting) => {
  if (!ioInstance || !adminId) return;
  const payload = {
    adminId: String(adminId),
    restaurantName: setting.restaurantName,
    taxPercentage: setting.taxPercentage,
    currency: setting.currency,
    upiId: setting.upiId,
    logo: setting.logo,
    themeColor: setting.themeColor
  };
  ioInstance.to(getRestaurantRoom(String(adminId))).emit('settings_updated', payload);
};

module.exports = {
  initSocket,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitPaymentPending,
  emitPaymentSuccess,
  emitOrderRating,
  emitMembershipRenewalRequest,
  emitMembershipActivated,
  emitMembershipOfferSent,
  emitMembershipRenewalRejected,
  emitAdminStatusChanged,
  emitSettingsUpdated
};
