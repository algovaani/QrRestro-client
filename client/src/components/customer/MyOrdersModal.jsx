import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useTableRoomSocket } from '../../hooks/useTableRoomSocket';
import CustomerNotificationToast from './CustomerNotificationToast';
import { getOrderStatusMessage, mobilesMatch, vibrateCustomerAlert } from '../../utils/orderNotifications';
import { sendOrderBillOnWhatsApp } from '../../utils/billShare';
import UPIPaymentModal from './UPIPaymentModal';
import { X, ShoppingBag, CheckCircle2, ChevronRight, QrCode, MessageSquare, Utensils, Loader2 } from 'lucide-react';

export default function MyOrdersModal({ tableNumber, adminId, customerMobile, onClose, onOrderMore }) {
  const [tableOrders, setTableOrders] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selected Order for UPI Payment Modal
  const [payOrderNumber, setPayOrderNumber] = useState(null);
  const [statusToast, setStatusToast] = useState('');
  const [billSendingId, setBillSendingId] = useState(null);

  const { socket, playOrderChime } = useSocket();

  useEffect(() => {
    if (tableNumber && adminId && customerMobile) {
      fetchTableSessionOrders();
    }
  }, [tableNumber, adminId, customerMobile]);

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
        if (
          String(updatedOrder.tableNumber) !== String(tableNumber) ||
          !mobilesMatch(updatedOrder.customerMobile, customerMobile)
        ) {
          return;
        }
        setTableOrders((prev) =>
          prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o))
        );
        playOrderChime();
        vibrateCustomerAlert();
        setStatusToast(getOrderStatusMessage(updatedOrder));
      },
      onPaymentPending: (updatedOrder) => {
        if (
          String(updatedOrder.tableNumber) !== String(tableNumber) ||
          !mobilesMatch(updatedOrder.customerMobile, customerMobile)
        ) {
          return;
        }
        setTableOrders((prev) =>
          prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o))
        );
        setStatusToast(`⏳ Payment submitted for Order #${updatedOrder.orderNumber} — waiting for admin approval`);
      },
      onPaymentSuccess: (updatedOrder) => {
        if (
          String(updatedOrder.tableNumber) !== String(tableNumber) ||
          !mobilesMatch(updatedOrder.customerMobile, customerMobile)
        ) {
          return;
        }
        setTableOrders((prev) =>
          prev.map((o) => (String(o._id) === String(updatedOrder._id) ? updatedOrder : o))
        );
        playOrderChime();
        vibrateCustomerAlert();
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

  const handlePaymentSuccess = () => {
    setPayOrderNumber(null);
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
      setStatusToast('Bill PDF share nahi ho payi.');
    } finally {
      setBillSendingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <CustomerNotificationToast
        message={statusToast}
        onDismiss={() => setStatusToast('')}
        aboveNav
      />
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', borderRadius: '24px', padding: '1.25rem', maxHeight: '85vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--secondary)' }}>
              My Table Orders ({tableOrders.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Table {tableNumber} • Running Total: <strong>₹{sessionTotal}</strong>
            </span>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', padding: '0.3rem', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading your table orders...
          </div>
        ) : tableOrders.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
            {tableOrders.map((order, idx) => (
              <div key={order._id} style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--border)', padding: '1rem' }}>
                
                {/* Round / Order Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '800', background: 'var(--primary-light)', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                      Round #{tableOrders.length - idx}
                    </span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--secondary)', marginTop: '0.2rem' }}>
                      {order.orderNumber}
                    </h4>
                  </div>

                  <span className={`badge badge-${order.orderStatus.toLowerCase()}`} style={{ fontWeight: '800' }}>
                    {order.orderStatus}
                  </span>
                </div>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  {order.items.map((item, itemIdx) => (
                    <div key={itemIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--secondary)', fontWeight: '500' }}>
                        {item.itemName} ({item.size}) x{item.quantity}
                      </span>
                      <span style={{ fontWeight: '700' }}>₹{item.total}</span>
                    </div>
                  ))}
                </div>

                {/* Footer Payment Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ORDER TOTAL</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)' }}>
                      ₹{order.grandTotal}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {order.paymentStatus === 'Paid' ? (
                      <span className="badge badge-paid" style={{ fontSize: '0.75rem' }}>
                        ✓ Paid
                      </span>
                    ) : order.paymentStatus === 'Pending' ? (
                      <button
                        onClick={() => setPayOrderNumber(order.orderNumber)}
                        className="badge badge-pending"
                        style={{ fontSize: '0.75rem', cursor: 'pointer', border: 'none' }}
                      >
                        ⏳ Pending — View
                      </button>
                    ) : (
                      <button
                        onClick={() => setPayOrderNumber(order.orderNumber)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}
                      >
                        <QrCode size={14} /> Pay ₹{order.grandTotal}
                      </button>
                    )}

                    <button
                      onClick={() => sendWhatsAppBill(order)}
                      disabled={billSendingId === order._id}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.35rem 0.5rem', color: '#25D366' }}
                      title="WhatsApp PDF Bill"
                    >
                      {billSendingId === order._id ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '16px', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2.5rem' }}>🍽️</div>
            <h4 style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.5rem' }}>No orders placed yet</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Add items from the menu to place your first order.
            </p>
          </div>
        )}

        {/* Action Button: Order More Items */}
        <button
          onClick={() => {
            onClose();
            if (onOrderMore) onOrderMore();
          }}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', borderRadius: '14px' }}
        >
          <Utensils size={18} /> + Order More Items for Table {tableNumber}
        </button>

      </div>

      {/* Dynamic UPI Payment Modal trigger */}
      {payOrderNumber && (
        <UPIPaymentModal
          orderNumber={payOrderNumber}
          onClose={() => setPayOrderNumber(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
