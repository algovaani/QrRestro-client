import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const getTableRoom = (adminId, tableNumber) => {
  if (!adminId || !tableNumber) return null;
  return `table_${adminId}_${tableNumber}`;
};

const playOrderChime = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch (e) {
    console.log('Audio playback prevented or unsupported', e);
  }
};

export const SocketProvider = ({ children }) => {
  const { user, token, updateUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    setSocket(newSocket);

    const tenantId = user && token && user.role !== 'SuperAdmin'
      ? (user.role === 'Admin' ? user._id : user.restaurantAdminId)
      : null;

    newSocket.on('connect', () => {
      if (tenantId) {
        newSocket.emit('join_room', `admin_${tenantId}`);
        newSocket.emit('join_room', `kitchen_${tenantId}`);
      }
      if (user?.role === 'SuperAdmin') {
        newSocket.emit('join_room', 'super_admin');
      }
    });

    newSocket.on('connect_error', (err) => {
      console.log('Socket reconnecting...', err.message);
    });

    const vibrateAlert = () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([180, 80, 180]);
      }
    };

    const handleNewOrder = (order) => {
      if (!tenantId) return;
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
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 8000);
    };

    const handlePaymentPending = (order) => {
      if (!tenantId) return;
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
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 12000);
    };

    const handlePaymentSuccess = (order) => {
      if (!tenantId) return;
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
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 8000);
    };

    const handleMembershipOfferSent = (data) => {
      if (user?.role !== 'Admin' || !tenantId) return;
      playOrderChime();
      vibrateAlert();
      if (updateUser) {
        updateUser({
          membershipOfferSent: true,
          membershipOfferPlanName: data.membershipOfferPlanName || '',
          membershipOfferSentAt: data.membershipOfferSentAt
        });
      }
      const newNotif = {
        id: `membership_offer_${Date.now()}`,
        type: 'membership_offer_sent',
        title: '📩 MEMBERSHIP OFFER RECEIVED',
        message: data.message || 'Super Admin ne membership renew ka offer bheja hai.',
        timestamp: new Date(),
        actionPath: '/admin/membership'
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 15000);
    };

    const handleMembershipActivated = (data) => {
      if (user?.role !== 'Admin' || !tenantId) return;
      playOrderChime();
      vibrateAlert();
      if (updateUser) {
        updateUser({
          planName: data.planName,
          planStatus: data.planStatus || 'Active',
          subscriptionEndsAt: data.subscriptionEndsAt,
          renewalRequested: false,
          requestedPlanName: '',
          membershipOfferSent: false,
          membershipOfferPlanName: '',
          isExpired: false,
          isActive: true
        });
      }
      const newNotif = {
        id: `membership_active_${Date.now()}`,
        type: 'membership_activated',
        title: '🎉 MEMBERSHIP ACTIVATED!',
        message: data.message || `Your ${data.planName} plan is now active.`,
        timestamp: new Date(),
        actionPath: '/admin/dashboard'
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 15000);
    };

    const handleMembershipRenewalRequest = (data) => {
      if (user?.role !== 'SuperAdmin') return;
      playOrderChime();
      vibrateAlert();
      const newNotif = {
        id: `membership_req_${data.adminId}_${Date.now()}`,
        type: 'membership_renewal_request',
        title: '📋 NEW MEMBERSHIP REQUEST',
        message: `${data.restaurantName} requested ${data.requestedPlanName || 'membership renewal'}`,
        timestamp: new Date(),
        adminData: data,
        actionPath: '/super-admin/dashboard'
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 12000);
    };

    const handleAdminStatusChanged = (data) => {
      if (user?.role !== 'Admin' || String(user._id) !== String(data.adminId)) return;
      if (updateUser) {
        updateUser({
          isActive: data.isActive,
          membershipOfferSent: Boolean(data.membershipOfferSent),
          membershipOfferPlanName: data.membershipOfferPlanName || '',
          renewalRequested: Boolean(data.renewalRequested),
          requestedPlanName: data.requestedPlanName || ''
        });
      }
    };

    newSocket.on('new_order', handleNewOrder);
    newSocket.on('payment_pending', handlePaymentPending);
    newSocket.on('payment_success', handlePaymentSuccess);
    newSocket.on('membership_activated', handleMembershipActivated);
    newSocket.on('membership_renewal_request', handleMembershipRenewalRequest);
    newSocket.on('membership_offer_sent', handleMembershipOfferSent);
    newSocket.on('admin_status_changed', handleAdminStatusChanged);

    return () => {
      newSocket.off('new_order', handleNewOrder);
      newSocket.off('payment_pending', handlePaymentPending);
      newSocket.off('payment_success', handlePaymentSuccess);
      newSocket.off('membership_activated', handleMembershipActivated);
      newSocket.off('membership_renewal_request', handleMembershipRenewalRequest);
      newSocket.off('membership_offer_sent', handleMembershipOfferSent);
      newSocket.off('admin_status_changed', handleAdminStatusChanged);
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user, token, updateUser]);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, removeNotification, playOrderChime }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
