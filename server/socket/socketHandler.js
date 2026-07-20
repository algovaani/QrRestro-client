let ioInstance = null;

const toPayload = (order) => (order?.toObject ? order.toObject() : order);

const getAdminRoom = (adminId) => `admin_${adminId}`;
const getKitchenRoom = (adminId) => `kitchen_${adminId}`;
const getTableRoom = (adminId, tableNumber) => `table_${adminId}_${tableNumber}`;

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

const emitNewOrder = (order) => emitToTenant(order, 'new_order');
const emitOrderStatusUpdate = (order) => emitToTenant(order, 'order_status_update');
const emitPaymentPending = (order) => emitToTenant(order, 'payment_pending');
const emitPaymentSuccess = (order) => emitToTenant(order, 'payment_success');

const emitMembershipRenewalRequest = (admin) => {
  if (!ioInstance || !admin?._id) return;
  const payload = {
    adminId: String(admin._id),
    restaurantName: admin.restaurantName,
    adminName: admin.name,
    email: admin.email,
    planName: admin.planName,
    requestedPlanName: admin.requestedPlanName || '',
    renewalRequestDate: admin.renewalRequestDate
  };
  ioInstance.to('super_admin').emit('membership_renewal_request', payload);
};

const emitMembershipActivated = (admin) => {
  if (!ioInstance || !admin?._id) return;
  const expiry = admin.subscriptionEndsAt || admin.trialEndsAt;
  const payload = {
    adminId: String(admin._id),
    planName: admin.planName,
    planStatus: admin.planStatus,
    subscriptionEndsAt: expiry,
    renewalRequested: false,
    requestedPlanName: '',
    membershipOfferSent: false,
    membershipOfferPlanName: '',
    isExpired: false,
    isActive: admin.isActive,
    message: `Membership activated! ${admin.planName} valid until ${expiry ? new Date(expiry).toLocaleDateString('en-IN') : 'N/A'}`
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
      ? `Super Admin ne "${admin.membershipOfferPlanName}" membership offer bheja hai. Ab renew kar sakte hain.`
      : 'Super Admin ne membership renew karne ka offer bheja hai.'
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
      ? 'Super Admin ne aapka account activate kar diya hai.'
      : 'Super Admin ne aapka account deactivate kar diya hai.'
  };
  ioInstance.to(getAdminRoom(String(admin._id))).emit('admin_status_changed', payload);
};

module.exports = {
  initSocket,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitPaymentPending,
  emitPaymentSuccess,
  emitMembershipRenewalRequest,
  emitMembershipActivated,
  emitMembershipOfferSent,
  emitAdminStatusChanged
};
