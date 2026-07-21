import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useTableSessionOrders, getPayOrderNumber } from '../../hooks/useTableSessionOrders';
import { useSocket } from '../../context/SocketContext';
import { useTableRoomSocket } from '../../hooks/useTableRoomSocket';
import { useLivePolling, useSocketReconnectRefetch } from '../../hooks/useLivePolling';
import CustomerNotificationToast from '../../components/customer/CustomerNotificationToast';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import MyOrdersModal from '../../components/customer/MyOrdersModal';
import { getOrderStatusMessage, mobilesMatch, vibrateCustomerAlert } from '../../utils/orderNotifications';
import UPIPaymentModal from '../../components/customer/UPIPaymentModal';
import { ArrowLeft, CheckCircle2, Clock, ChefHat, Sparkles, UtensilsCrossed, QrCode, Star, Send } from 'lucide-react';

export default function OrderStatusPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveToast, setLiveToast] = useState('');

  // Rating States
  const [userRating, setUserRating] = useState(5);
  const [userReview, setUserReview] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);

  const { initTableCart, customerMobile } = useCart();

  useEffect(() => {
    if (order?.adminId && order?.tableNumber) {
      initTableCart(String(order.tableNumber), String(order.adminId));
    }
  }, [order?.adminId, order?.tableNumber]);

  const { orders, refreshOrders } = useTableSessionOrders(
    order?.adminId,
    order?.tableNumber,
    customerMobile || order?.customerMobile
  );

  const handlePayClick = () => {
    if (order?.paymentStatus === 'Unpaid' && order?.paymentMethod === 'UPI') {
      setShowPaymentModal(true);
      return;
    }
    const num = getPayOrderNumber(orders) || order?.orderNumber;
    if (num) setShowPaymentModal(true);
    else alert('No unpaid order found.');
  };

  const { socket, playOrderChime } = useSocket();
  const lastStatusRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!orderNumber) return;
    try {
      const res = await API.get(`/public/orders/${orderNumber}/status`);
      if (res.data.success) {
        const nextOrder = res.data.order;
        const prevStatus = lastStatusRef.current;
        setOrder(nextOrder);
        lastStatusRef.current = nextOrder.orderStatus;
        if (nextOrder.rating) {
          setUserRating(nextOrder.rating);
          setUserReview(nextOrder.review || '');
          setRatingSubmitted(true);
        }
        if (prevStatus && prevStatus !== nextOrder.orderStatus) {
          playOrderChime();
          vibrateCustomerAlert();
          setLiveToast(getOrderStatusMessage(nextOrder));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [orderNumber, playOrderChime]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useSocketReconnectRefetch(socket, fetchStatus, Boolean(orderNumber));
  useLivePolling(fetchStatus, 8000, Boolean(orderNumber));

  useEffect(() => {
    if (!liveToast) return undefined;
    const timer = setTimeout(() => setLiveToast(''), 8000);
    return () => clearTimeout(timer);
  }, [liveToast]);

  useTableRoomSocket(
    socket,
    order?.adminId,
    order?.tableNumber,
    order
      ? {
          onPaymentPending: (updatedOrder) => {
            if (
              updatedOrder.orderNumber !== orderNumber &&
              (!order || String(updatedOrder._id) !== String(order._id))
            ) {
              return;
            }
            setOrder(updatedOrder);
            setLiveToast(`⏳ Payment submitted for Order #${updatedOrder.orderNumber} — waiting for admin approval`);
          },
          onPaymentSuccess: (updatedOrder) => {
            if (
              updatedOrder.orderNumber !== orderNumber &&
              (!order || String(updatedOrder._id) !== String(order._id))
            ) {
              return;
            }
            setOrder(updatedOrder);
            playOrderChime();
            vibrateCustomerAlert();
            setLiveToast(`💳 Payment approved for Order #${updatedOrder.orderNumber}!`);
          },
          onStatusUpdate: (updatedOrder) => {
            if (
              updatedOrder.orderNumber !== orderNumber &&
              (!order || String(updatedOrder._id) !== String(order._id))
            ) {
              return;
            }
            setOrder(updatedOrder);
            if (updatedOrder.paymentStatus === 'Unpaid' && order?.paymentStatus === 'Pending') {
              setLiveToast(`Payment for Order #${updatedOrder.orderNumber} was not approved. Please try again.`);
              return;
            }
            playOrderChime();
            vibrateCustomerAlert();
            setLiveToast(getOrderStatusMessage(updatedOrder));
          }
        }
      : {}
  );

  const handlePaymentSuccess = (updatedOrder) => {
    setOrder(updatedOrder);
    setShowPaymentModal(false);
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    setSubmittingRating(true);
    try {
      const res = await API.post(`/public/orders/${orderNumber}/rate`, {
        rating: userRating,
        review: userReview
      });
      if (res.data.success) {
        setRatingSubmitted(true);
      }
    } catch (err) {
      alert('Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const steps = [
    { status: 'New', label: 'Order Placed', desc: 'Order received by restaurant', icon: Clock },
    { status: 'Confirmed', label: 'Confirmed by Admin', desc: 'Order accepted & queued', icon: CheckCircle2 },
    { status: 'Preparing', label: 'Cooking in Kitchen', desc: 'Chef is preparing your fresh meal', icon: ChefHat },
    { status: 'Ready', label: 'Ready to Serve', desc: 'Hot food is ready for table', icon: Sparkles },
    { status: 'Served', label: 'Served at Table', desc: 'Served at your table. Enjoy your meal!', icon: UtensilsCrossed }
  ];

  const getStepIndex = (status) => {
    switch (status) {
      case 'New': return 0;
      case 'Confirmed': return 1;
      case 'Preparing': return 2;
      case 'Ready': return 3;
      case 'Served':
      case 'Completed': return 4;
      default: return 0;
    }
  };

  const currentStep = order ? getStepIndex(order.orderStatus) : 0;

  return (
    <div className="customer-mobile-wrap" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '6rem' }}>
      <CustomerNotificationToast
        message={liveToast}
        onDismiss={() => setLiveToast('')}
        aboveNav
      />

      {/* Top Navigation Bar */}
      <div style={{ background: '#ffffff', padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 80 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '0.4rem', borderRadius: '50%', background: '#f1f5f9' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)' }}>Live Table Order Status</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Order #{orderNumber}</span>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1rem' }}>
        {order ? (
          <>
            {/* Payment Callout Banner */}
            <div style={{
              background: order.paymentStatus === 'Paid' ? '#dcfce7' : order.paymentStatus === 'Pending' ? '#fef3c7' : '#fff0e6',
              borderRadius: '16px',
              border: `1px solid ${order.paymentStatus === 'Paid' ? '#bbf7d0' : order.paymentStatus === 'Pending' ? '#fcd34d' : '#ffd6bc'}`,
              padding: '1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: order.paymentStatus === 'Paid' ? '#166534' : order.paymentStatus === 'Pending' ? '#b45309' : '#c2410c', fontWeight: '700' }}>
                  {order.paymentStatus === 'Paid' ? '✓ Payment Complete' : order.paymentStatus === 'Pending' ? '⏳ Approval Pending' : 'Payment Action Required'}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: order.paymentStatus === 'Paid' ? '#15803d' : order.paymentStatus === 'Pending' ? '#b45309' : 'var(--primary)' }}>
                  {order.paymentStatus === 'Paid' ? 'Paid via UPI' : order.paymentStatus === 'Pending' ? `₹${order.grandTotal} — Admin verifying` : `₹${order.grandTotal} Unpaid`}
                </div>
                {order.transactionId && (
                  <div style={{ fontSize: '0.7rem', color: order.paymentStatus === 'Paid' ? '#15803d' : '#92400e', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                    TXN: {order.transactionId}
                  </div>
                )}
              </div>

              {order.paymentStatus === 'Unpaid' && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="btn btn-primary pulse-button"
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', borderRadius: '12px' }}
                >
                  <QrCode size={16} /> Pay Now
                </button>
              )}
              {order.paymentStatus === 'Pending' && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', borderRadius: '12px' }}
                >
                  View Status
                </button>
              )}
            </div>

            {/* Live Hand to Hand Timeline Container */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <span className={`badge badge-${order.orderStatus.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', fontWeight: '800' }}>
                  Live Status: {order.orderStatus}
                </span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  Table {order.tableNumber} • Hand to Hand Real-Time Sync
                </div>
              </div>

              {/* Vertical Timeline Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isCurrent ? 'var(--primary)' : isDone ? '#dcfce7' : '#f1f5f9',
                        color: isCurrent ? '#ffffff' : isDone ? '#15803d' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        zIndex: 2,
                        boxShadow: isCurrent ? '0 0 0 6px var(--primary-light)' : 'none',
                        transition: 'all 0.3s ease'
                      }}>
                        <Icon size={20} />
                      </div>

                      <div style={{ flex: 1, background: isCurrent ? 'var(--primary-light)' : 'transparent', padding: isCurrent ? '0.6rem 0.85rem' : '0', borderRadius: '10px' }}>
                        <div style={{ fontWeight: isDone ? '800' : '600', color: isCurrent ? 'var(--primary)' : isDone ? 'var(--secondary)' : 'var(--text-light)', fontSize: '0.95rem' }}>
                          {step.label} {isCurrent && '⚡'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: isCurrent ? 'var(--secondary)' : 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {step.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CUSTOMER STAR RATING & FEEDBACK CARD */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.4rem' }}>
                ⭐ Rate Your Dining Experience
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                How was the taste, speed, and service?
              </p>

              {ratingSubmitted ? (
                <div style={{ background: '#ecfdf5', color: '#065f46', padding: '0.85rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700' }}>
                  🎉 Thank you for rating us {userRating} Stars! {userReview && `("${userReview}")`}
                </div>
              ) : (
                <form onSubmit={handleRatingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {/* Interactive 5 Stars */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star)}
                        style={{ padding: '0.2rem', transition: 'transform 0.15s ease' }}
                      >
                        <Star
                          size={32}
                          color={star <= userRating ? '#f59e0b' : '#cbd5e1'}
                          fill={star <= userRating ? '#f59e0b' : 'none'}
                        />
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Write a quick comment (Optional)..."
                    value={userReview}
                    onChange={(e) => setUserReview(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem', textAlign: 'center' }}
                  />

                  <button
                    type="submit"
                    disabled={submittingRating}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', fontSize: '0.85rem', gap: '0.4rem' }}
                  >
                    <Send size={15} />
                    <span>{submittingRating ? 'Submitting...' : 'Submit Rating & Review'}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Order Items Recap */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
                Ordered Items Summary
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span>{item.itemName} ({item.size}) x{item.quantity}</span>
                    <span style={{ fontWeight: '700' }}>₹{item.total}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1rem', marginTop: '0.4rem', color: 'var(--primary)' }}>
                  <span>Grand Total</span>
                  <span>₹{order.grandTotal}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(`/menu/${order.adminId}/table/${order.tableNumber}`)}
                className="btn btn-secondary"
                style={{ width: '100%', borderRadius: '12px' }}
              >
                Return to Digital Menu
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            Loading live order status...
          </div>
        )}
      </div>

      <CustomerBottomNav
        activeTab="orders"
        onMyOrders={() => setShowMyOrdersModal(true)}
        onPay={handlePayClick}
        ordersCount={orders.length}
      />

      {showMyOrdersModal && order && (
        <MyOrdersModal
          tableNumber={order.tableNumber}
          adminId={order.adminId}
          customerMobile={customerMobile || order.customerMobile}
          onClose={() => setShowMyOrdersModal(false)}
          onOrderMore={() => {
            setShowMyOrdersModal(false);
            navigate(`/menu/${order.adminId}/table/${order.tableNumber}`);
          }}
        />
      )}

      {showPaymentModal && order && (
        <UPIPaymentModal
          orderNumber={order.orderNumber}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(updatedOrder) => {
            handlePaymentSuccess(updatedOrder);
            refreshOrders();
          }}
        />
      )}

    </div>
  );
}
