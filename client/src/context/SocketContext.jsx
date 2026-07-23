import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getSocketUrl, getRestaurantRoom } from '../utils/socketUrl';
import { playOrderChime } from '../utils/orderChime';

const SocketContext = createContext();

export const getTableRoom = (adminId, tableNumber) => {
  if (!adminId || tableNumber === undefined || tableNumber === null || tableNumber === '') return null;
  return `table_${adminId}_${String(tableNumber)}`;
};

export { getRestaurantRoom };

const getTenantId = (user, token) => {
  if (!user || !token || user.role === 'SuperAdmin') return null;
  if (user.role === 'Admin') return String(user._id);
  if (user.restaurantAdminId) return String(user.restaurantAdminId);
  return null;
};

export const SocketProvider = ({ children }) => {
  const { user, token, authReady, updateUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const tenantId = useMemo(() => getTenantId(user, token), [user, token]);
  const authRef = useRef({ user, tenantId, updateUser });
  const prevTenantRef = useRef(null);
  authRef.current = { user, tenantId, updateUser };

  // Single long-lived socket — do not recreate on every auth/user update
  useEffect(() => {
    const newSocket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    setSocket(newSocket);
    setIsConnected(newSocket.connected);

    const vibrateAlert = () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([180, 80, 180]);
      }
    };

    const belongsToTenant = (order) => {
      const { tenantId: tid } = authRef.current;
      return tid && order?.adminId && String(order.adminId) === String(tid);
    };

    const handleNewOrder = (order) => {
      if (!belongsToTenant(order)) return;
      playOrderChime();
      vibrateAlert();
      const newNotif = {
        id: `${order._id || order.orderNumber}_${Date.now()}`,
        type: 'new_order',
        title: '🚨 NEW ORDER RECEIVED!',
        message: `Order #${order.orderNumber} for Table ${order.tableNumber} (₹${order.grandTotal})`,
        order,
        timestamp: new Date()
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.type === 'new_order' && String(n.order?._id) === String(order._id))) {
          return prev;
        }
        return [newNotif, ...prev];
      });
    };

    const handlePaymentPending = (order) => {
      if (!belongsToTenant(order)) return;
      playOrderChime();
      vibrateAlert();
      const newNotif = {
        id: `${order._id || order.orderNumber}_pending_${Date.now()}`,
        type: 'payment_pending',
        title: '⏳ PAYMENT APPROVAL PENDING',
        message: `Table ${order.tableNumber} submitted ₹${order.grandTotal} for Order #${order.orderNumber}${order.transactionId ? ` (TXN: ${order.transactionId})` : ''}`,
        order,
        timestamp: new Date()
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.type === 'payment_pending' && String(n.order?._id) === String(order._id))) {
          return prev;
        }
        return [newNotif, ...prev];
      });
    };

    const handlePaymentSuccess = (order) => {
      if (!belongsToTenant(order)) return;
      playOrderChime();
      vibrateAlert();
      const newNotif = {
        id: `${order._id || order.orderNumber}_pay_${Date.now()}`,
        type: 'payment',
        title: '💳 PAYMENT RECEIVED!',
        message: `Table ${order.tableNumber} paid ₹${order.grandTotal} for Order #${order.orderNumber}`,
        order,
        timestamp: new Date()
      };
      setNotifications((prev) => {
        const recent = prev.some(
          (n) =>
            n.type === 'payment' &&
            String(n.order?._id) === String(order._id) &&
            Date.now() - new Date(n.timestamp).getTime() < 3000
        );
        if (recent) return prev;
        return [newNotif, ...prev];
      });
    };

    const handleOrderRating = (order) => {
      if (!belongsToTenant(order)) return;
      playOrderChime();
      vibrateAlert();
      const reviewNote = order.review ? ` — "${order.review}"` : '';
      const newNotif = {
        id: `${order._id || order.orderNumber}_rating_${Date.now()}`,
        type: 'order_rating',
        title: 'NEW CUSTOMER RATING',
        message: `Order #${order.orderNumber} rated ${order.rating}/5${reviewNote}`,
        order,
        timestamp: new Date()
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.type === 'order_rating' && String(n.order?._id) === String(order._id))) {
          return prev;
        }
        return [newNotif, ...prev];
      });
    };

    const handleMembershipOfferSent = (data) => {
      const { user: currentUser, tenantId: tid, updateUser: patchUser } = authRef.current;
      if (currentUser?.role !== 'Admin' || !tid || String(data.adminId) !== String(tid)) return;
      playOrderChime();
      vibrateAlert();
      patchUser?.({
        membershipOfferSent: true,
        membershipOfferPlanName: data.membershipOfferPlanName || '',
        membershipOfferSentAt: data.membershipOfferSentAt
      });
      const newNotif = {
        id: `membership_offer_${Date.now()}`,
        type: 'membership_offer_sent',
        title: '📩 MEMBERSHIP OFFER RECEIVED',
        message: data.message || 'Super Admin sent a membership renewal offer.',
        timestamp: new Date(),
        actionPath: '/admin/membership'
      };
      setNotifications((prev) => [newNotif, ...prev]);
    };

    const handleMembershipActivated = (data) => {
      const { user: currentUser, tenantId: tid, updateUser: patchUser } = authRef.current;
      if (currentUser?.role !== 'Admin' || !tid || String(data.adminId) !== String(tid)) return;
      playOrderChime();
      vibrateAlert();
      patchUser?.({
        planName: data.planName,
        planStatus: data.planStatus || 'Active',
        subscriptionEndsAt: data.subscriptionEndsAt,
        daysRemaining: data.daysRemaining,
        renewalRequested: false,
        requestedPlanName: '',
        membershipOfferSent: false,
        membershipOfferPlanName: '',
        isExpired: false,
        isActive: true
      });
      const newNotif = {
        id: `membership_active_${Date.now()}`,
        type: 'membership_activated',
        title: '🎉 MEMBERSHIP ACTIVATED!',
        message: data.message || `Your ${data.planName} plan is now active.`,
        timestamp: new Date(),
        actionPath: '/admin/dashboard'
      };
      setNotifications((prev) => [newNotif, ...prev]);
    };

    const handleMembershipRenewalRequest = (data) => {
      const { user: currentUser } = authRef.current;
      if (currentUser?.role !== 'SuperAdmin') return;
      playOrderChime();
      vibrateAlert();
      const proofNote = data.renewalPaymentProof ? ' (payment screenshot attached)' : '';
      const newNotif = {
        id: `membership_req_${data.adminId}_${Date.now()}`,
        type: 'membership_renewal_request',
        title: '📋 NEW MEMBERSHIP REQUEST',
        message: `${data.restaurantName} requested ${data.requestedPlanName || 'membership renewal'}${proofNote}`,
        timestamp: new Date(),
        adminData: data,
        actionPath: '/super-admin/dashboard'
      };
      setNotifications((prev) => [newNotif, ...prev]);
    };

    const handleMembershipRenewalRejected = (data) => {
      const { user: currentUser, tenantId: tid, updateUser: patchUser } = authRef.current;
      if (currentUser?.role !== 'Admin' || !tid || String(data.adminId) !== String(tid)) return;
      playOrderChime();
      vibrateAlert();
      patchUser?.({
        renewalRequested: false,
        requestedPlanName: '',
        renewalPaymentProof: '',
        renewalRejectionReason: data.renewalRejectionReason || data.message || '',
        renewalRejectedAt: data.renewalRejectedAt
      });
      const newNotif = {
        id: `membership_rejected_${Date.now()}`,
        type: 'membership_renewal_rejected',
        title: '❌ MEMBERSHIP REQUEST REJECTED',
        message: data.message || data.renewalRejectionReason || 'Your request was rejected. Upload a new payment screenshot.',
        timestamp: new Date(),
        actionPath: '/subscription-expired'
      };
      setNotifications((prev) => [newNotif, ...prev]);
    };

    const handleAdminStatusChanged = (data) => {
      const { user: currentUser, updateUser: patchUser } = authRef.current;
      if (currentUser?.role !== 'Admin' || String(currentUser._id) !== String(data.adminId)) return;
      patchUser?.({
        isActive: data.isActive,
        membershipOfferSent: Boolean(data.membershipOfferSent),
        membershipOfferPlanName: data.membershipOfferPlanName || '',
        renewalRequested: Boolean(data.renewalRequested),
        requestedPlanName: data.requestedPlanName || '',
        planStatus: data.isActive ? currentUser.planStatus : 'Expired'
      });

      if (!data.isActive) {
        playOrderChime();
        vibrateAlert();
        const newNotif = {
          id: `admin_deactivated_${Date.now()}`,
          type: 'membership_offer_sent',
          title: '⚠️ ACCOUNT DEACTIVATED',
          message: data.message || 'Your account has been deactivated. Renew your membership.',
          timestamp: new Date(),
          actionPath: '/subscription-expired'
        };
        setNotifications((prev) => [newNotif, ...prev]);

        if (
          window.location.pathname.startsWith('/admin') &&
          !window.location.pathname.includes('subscription-expired') &&
          !window.location.pathname.includes('/admin/membership')
        ) {
          window.location.href = '/subscription-expired';
        }
      }
    };

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('connect_error', (err) => {
      console.log('Socket reconnecting...', err.message);
    });
    newSocket.on('new_order', handleNewOrder);
    newSocket.on('payment_pending', handlePaymentPending);
    newSocket.on('payment_success', handlePaymentSuccess);
    newSocket.on('order_rating', handleOrderRating);
    newSocket.on('membership_activated', handleMembershipActivated);
    newSocket.on('membership_renewal_request', handleMembershipRenewalRequest);
    newSocket.on('membership_renewal_rejected', handleMembershipRenewalRejected);
    newSocket.on('membership_offer_sent', handleMembershipOfferSent);
    newSocket.on('admin_status_changed', handleAdminStatusChanged);

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('new_order', handleNewOrder);
      newSocket.off('payment_pending', handlePaymentPending);
      newSocket.off('payment_success', handlePaymentSuccess);
      newSocket.off('order_rating', handleOrderRating);
      newSocket.off('membership_activated', handleMembershipActivated);
      newSocket.off('membership_renewal_request', handleMembershipRenewalRequest);
      newSocket.off('membership_renewal_rejected', handleMembershipRenewalRejected);
      newSocket.off('membership_offer_sent', handleMembershipOfferSent);
      newSocket.off('admin_status_changed', handleAdminStatusChanged);
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, []);

  // Join tenant rooms whenever auth is ready — leave old tenant rooms on account switch
  useEffect(() => {
    if (!socket || !authReady) return;

    const leaveTenantRooms = (id) => {
      if (!id) return;
      socket.emit('leave_room', `admin_${id}`);
      socket.emit('leave_room', `kitchen_${id}`);
      socket.emit('leave_room', `restaurant_${id}`);
    };

    const joinRooms = () => {
      const prev = prevTenantRef.current;
      if (prev && prev !== tenantId) {
        leaveTenantRooms(prev);
        setNotifications([]);
      }
      if (!tenantId && prev) {
        leaveTenantRooms(prev);
        setNotifications([]);
      }
      prevTenantRef.current = tenantId || null;

      if (tenantId) {
        socket.emit('join_room', `admin_${tenantId}`);
        socket.emit('join_room', `kitchen_${tenantId}`);
        socket.emit('join_room', `restaurant_${tenantId}`);
      }
      if (user?.role === 'SuperAdmin') {
        socket.emit('join_room', 'super_admin');
      }
    };

    joinRooms();
    socket.on('connect', joinRooms);

    return () => {
      socket.off('connect', joinRooms);
    };
  }, [socket, authReady, tenantId, user?.role]);

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, notifications, removeNotification, playOrderChime }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
