import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useTableRoomSocket } from '../../hooks/useTableRoomSocket';
import CustomerNotificationToast from './CustomerNotificationToast';
import { getOrderStatusMessage, orderMatchesCustomerSession, playCustomerOrderAlert } from '../../utils/orderNotifications';
import { sendOrderBillOnWhatsApp } from '../../utils/billShare';
import UPIPaymentModal from './UPIPaymentModal';
import { X, ChevronDown, ChevronUp, QrCode, MessageSquare, Utensils, Loader2, ExternalLink } from 'lucide-react';

function formatOrderTime(createdAt) {
  if (!createdAt) return '';
  return new Date(createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function MyOrdersModal({ tableNumber, adminId, customerMobile, onClose, onOrderMore }) {
  const navigate = useNavigate();
  const [tableOrders, setTableOrders] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const [payOrderNumbers, setPayOrderNumbers] = useState(null);
  const [statusToast, setStatusToast] = useState('');
  const [billSendingId, setBillSendingId] = useState(null);

  const { socket } = useSocket();

  useEffect(() => {
    if (tableNumber && adminId && customerMobile) {
      fetchTableSessionOrders();
    }
  }, [tableNumber, adminId, customerMobile]);

  useEffect(() => {
    if (tableOrders.length === 0) {
      setExpandedIds(new Set());
      return;
    }
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set([String(tableOrders[0]._id)]);
    });
  }, [tableOrders.length, tableOrders[0]?._id]);

  useEffect(() => {
    if (!statusToast) return undefined;
    const timer = setTimeout(() => setStatusToast(''), 8000);
    return () => clearTimeout(timer);
  }, [statusToast]);

  useTableRoomSocket(
    socket,
    adminId,
    tableNumber,
    {
      onStatusUpdate: (updatedOrder) => {
        if (!orderMatchesCustomerSession(updatedOrder, adminId, tableNumber, customerMobile)) {
          return;
        }
        setTableOrders((prev) =>
          prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o))
        );
        void playCustomerOrderAlert(updatedOrder);
        setStatusToast(getOrderStatusMessage(updatedOrder));
      },
      onPaymentPending: (updatedOrder) => {
        if (!orderMatchesCustomerSession(updatedOrder, adminId, tableNumber, customerMobile)) {
          return;
        }
        setTableOrders((prev) =>
          prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o))
        );
        setStatusToast(`⏳ Payment submitted for Order #${updatedOrder.orderNumber} — waiting for admin approval`);
      },
      onPaymentSuccess: (updatedOrder) => {
        if (!orderMatchesCustomerSession(updatedOrder, adminId, tableNumber, customerMobile)) {
          return;
        }
        setTableOrders((prev) =>
          prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o))
        );
        void playCustomerOrderAlert(updatedOrder);
        setStatusToast(`💳 Payment approved for Order #${updatedOrder.orderNumber}!`);
      }
    }
  );

  const fetchTableSessionOrders = async () => {
    if (!customerMobile || !adminId) return;
    setLoading(true);
    try {
      const res = await API.get(`/public/orders/table/${adminId}/${tableNumber}/active`, {
        params: { customerMobile }
      });
      if (res.data.success) {
        setTableOrders(res.data.orders || []);
        setSessionTotal(res.data.sessionTotal || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (orderId) => {
    const id = String(orderId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePaymentSuccess = () => {
    setPayOrderNumbers(null);
    fetchTableSessionOrders();
  };

  const sendWhatsAppBill = async (order) => {
    setBillSendingId(order._id);
    try {
      const result = await sendOrderBillOnWhatsApp(order);
      if (result.hint) {
        setStatusToast(result.hint);
      }
    } catch {
      setStatusToast('Could not share bill PDF.');
    } finally {
      setBillSendingId(null);
    }
  };

  const openOrderStatus = (order) => {
    onClose();
    navigate(`/order-status/${order.orderNumber}`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <CustomerNotificationToast
        message={statusToast}
        onDismiss={() => setStatusToast('')}
        aboveNav
      />
      <div className="modal-card my-orders-modal" onClick={(e) => e.stopPropagation()}>
        <div className="my-orders-modal__header">
          <div>
            <h3 className="my-orders-modal__title">
              My Table Orders ({tableOrders.length})
            </h3>
            <span className="my-orders-modal__subtitle">
              Table {tableNumber} • Running Total: <strong>₹{sessionTotal}</strong>
            </span>
          </div>
          <button type="button" onClick={onClose} className="my-orders-modal__close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="my-orders-modal__empty">Loading your table orders...</div>
        ) : tableOrders.length > 0 ? (
          <div className="my-orders-modal__list">
            {tableOrders.map((order, idx) => {
              const roundNum = tableOrders.length - idx;
              const isExpanded = expandedIds.has(String(order._id));

              return (
                <div key={order._id} className={`my-orders-round${isExpanded ? ' is-expanded' : ''}`}>
                  <button
                    type="button"
                    className="my-orders-round__header"
                    onClick={() => toggleExpanded(order._id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="my-orders-round__header-main">
                      <span className="my-orders-round__badge">Round #{roundNum}</span>
                      <h4 className="my-orders-round__number">{order.orderNumber}</h4>
                      <span className="my-orders-round__time">{formatOrderTime(order.createdAt)}</span>
                    </div>
                    <div className="my-orders-round__header-right">
                      <span className={`badge badge-${order.orderStatus.toLowerCase()}`}>
                        {order.orderStatus}
                      </span>
                      <span className="my-orders-round__total">₹{order.grandTotal}</span>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="my-orders-round__body">
                      <div className="my-orders-round__items">
                        {order.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="my-orders-round__item-row">
                            <span>
                              {item.itemName} ({item.size}) ×{item.quantity}
                              {item.instructions ? (
                                <span className="my-orders-round__note"> — {item.instructions}</span>
                              ) : null}
                            </span>
                            <span>₹{item.total}</span>
                          </div>
                        ))}
                      </div>

                      {order.notes ? (
                        <div className="my-orders-round__special-note">
                          <strong>Special note:</strong> {order.notes}
                        </div>
                      ) : null}

                      <div className="my-orders-round__summary">
                        <div><span>Subtotal</span><span>₹{order.subtotal ?? '—'}</span></div>
                        <div><span>Tax</span><span>₹{order.tax ?? '—'}</span></div>
                        <div className="my-orders-round__grand"><span>Grand Total</span><span>₹{order.grandTotal}</span></div>
                        <div><span>Payment</span><span>{order.paymentMethod} • {order.paymentStatus}</span></div>
                      </div>

                      <div className="my-orders-round__actions">
                        <button
                          type="button"
                          onClick={() => openOrderStatus(order)}
                          className="btn btn-secondary btn-sm my-orders-round__status-btn"
                        >
                          <ExternalLink size={14} /> Live Status
                        </button>

                        {order.paymentStatus === 'Paid' ? (
                          <span className="badge badge-paid">✓ Paid</span>
                        ) : order.paymentStatus === 'Pending' ? (
                          <button
                            type="button"
                            onClick={() => setPayOrderNumbers([order.orderNumber])}
                            className="badge badge-pending my-orders-round__pay-badge"
                          >
                            ⏳ Pending — View
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPayOrderNumbers([order.orderNumber])}
                            className="btn btn-primary btn-sm"
                          >
                            <QrCode size={14} /> Pay ₹{order.grandTotal}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => sendWhatsAppBill(order)}
                          disabled={billSendingId === order._id}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#25D366' }}
                          title="WhatsApp PDF Bill"
                        >
                          {billSendingId === order._id ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="my-orders-modal__empty my-orders-modal__empty--icon">
            <div style={{ fontSize: '2.5rem' }}>🍽️</div>
            <h4>No orders placed yet</h4>
            <p>Add items from the menu to place your first order.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOrderMore) onOrderMore();
          }}
          className="btn btn-primary my-orders-modal__more-btn"
        >
          <Utensils size={18} /> + Order More Items for Table {tableNumber}
        </button>
      </div>

      {payOrderNumbers?.length > 0 && (
        <UPIPaymentModal
          orderNumbers={payOrderNumbers}
          onClose={() => setPayOrderNumbers(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
