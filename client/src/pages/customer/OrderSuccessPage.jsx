import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../services/api';
import UPIPaymentModal from '../../components/customer/UPIPaymentModal';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import MyOrdersModal from '../../components/customer/MyOrdersModal';
import { useCart } from '../../context/CartContext';
import { useTableSessionOrders } from '../../hooks/useTableSessionOrders';
import { startCustomerPayFlow, getUnpaidOrders } from '../../utils/customerPayFlow';
import PayOrderPickerModal from '../../components/customer/PayOrderPickerModal';
import { CheckCircle2, Clock, Utensils, QrCode } from 'lucide-react';

export default function OrderSuccessPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrderNumbers, setPaymentOrderNumbers] = useState(null);
  const [showPayPicker, setShowPayPicker] = useState(false);
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

  const openPaymentModal = (orderNumOrNums) => {
    const nums = Array.isArray(orderNumOrNums) ? orderNumOrNums : [orderNumOrNums];
    if (!nums.length || !nums[0]) return;
    setPaymentOrderNumbers(nums);
    setShowPaymentModal(true);
  };

  const handlePayClick = () => {
    startCustomerPayFlow(orders, order?.tableNumber, {
      setPayOrderNumbers: (nums) => openPaymentModal(nums),
      setShowPayPicker
    });
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderNumber]);

  const fetchOrderDetails = async () => {
    try {
      const res = await API.get(`/public/orders/${orderNumber}/status`);
      if (res.data.success) {
        setOrder(res.data.order);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (updatedOrder) => {
    setOrder(updatedOrder);
    setShowPaymentModal(false);
  };

  return (
    <div className="customer-mobile-wrap" style={{ background: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem 1rem 6rem' }}>
      
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <div style={{
          width: '76px',
          height: '76px',
          background: '#dcfce7',
          color: '#15803d',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem auto'
        }}>
          <CheckCircle2 size={44} />
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--secondary)' }}>
          Order Placed Successfully!
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
          Sent to restaurant kitchen.
        </p>

        {/* Order Card */}
        {order && (
          <div style={{ background: '#f8fafc', borderRadius: '18px', border: '1px solid var(--border)', padding: '1.25rem', margin: '1.25rem 0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.6rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ORDER NUMBER</span>
                <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--primary)' }}>{order.orderNumber}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TABLE</span>
                <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>Table {order.tableNumber}</div>
              </div>
            </div>

            {/* Payment Banner */}
            <div style={{
              background: order.paymentStatus === 'Paid' ? '#dcfce7' : order.paymentStatus === 'Pending' ? '#fef3c7' : '#fff0e6',
              borderRadius: '12px',
              padding: '0.75rem',
              marginBottom: '1rem',
              border: `1px solid ${order.paymentStatus === 'Paid' ? '#bbf7d0' : order.paymentStatus === 'Pending' ? '#fcd34d' : '#ffd6bc'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: order.paymentStatus === 'Paid' ? '#166534' : order.paymentStatus === 'Pending' ? '#b45309' : '#c2410c', fontWeight: '700' }}>
                    Payment Status
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '1.05rem', color: order.paymentStatus === 'Paid' ? '#15803d' : order.paymentStatus === 'Pending' ? '#b45309' : 'var(--primary)' }}>
                    {order.paymentStatus === 'Paid' ? '✓ Paid via UPI' : order.paymentStatus === 'Pending' ? '⏳ Approval Pending' : `Unpaid (₹${order.grandTotal})`}
                  </div>
                </div>

                {order.paymentStatus === 'Unpaid' && order.paymentMethod === 'UPI' && (
                  <button
                    onClick={() => openPaymentModal(order.orderNumber)}
                    className="btn btn-primary pulse-button"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  >
                    <QrCode size={16} /> Scan QR & Pay
                  </button>
                )}
                {order.paymentStatus === 'Unpaid' && order.paymentMethod === 'Cash' && (
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#92400e', background: '#fef3c7', padding: '0.35rem 0.65rem', borderRadius: '8px' }}>
                    Pay at counter
                  </span>
                )}
                {order.paymentStatus === 'Pending' && (
                  <button
                    onClick={() => openPaymentModal(order.orderNumber)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  >
                    View Status
                  </button>
                )}
              </div>

              {order.transactionId && (
                <div style={{ fontSize: '0.75rem', color: order.paymentStatus === 'Paid' ? '#15803d' : '#92400e', marginTop: '0.4rem', fontFamily: 'monospace' }}>
                  TXN ID: {order.transactionId}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <strong>Items:</strong> {order.items.map(i => `${i.itemName} (${i.size}) x${i.quantity}`).join(', ')}
            </div>

            <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)' }}>
              Grand Total: ₹{order.grandTotal}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
        {order?.paymentStatus === 'Unpaid' && order?.paymentMethod === 'UPI' && (
          <button
            onClick={() => openPaymentModal(order.orderNumber)}
            className="btn btn-primary pulse-button"
            style={{ width: '100%', padding: '0.95rem', fontSize: '1rem', borderRadius: '14px' }}
          >
            <QrCode size={20} /> Scan UPI QR & Pay ₹{order.grandTotal}
          </button>
        )}

        <button
          onClick={() => navigate(`/order-status/${orderNumber}`)}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', borderRadius: '14px' }}
        >
          <Clock size={18} /> Track Live Order Status Timeline
        </button>

        {order && (
          <button
            type="button"
            onClick={() => navigate(`/menu/${order.adminId}/table/${order.tableNumber}`)}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', borderRadius: '14px' }}
          >
            <Utensils size={18} /> Add More Items
          </button>
        )}
      </div>

      <CustomerBottomNav
        activeTab="pay"
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

      {showPayPicker && (
        <PayOrderPickerModal
          orders={getUnpaidOrders(orders)}
          allOrders={orders}
          tableNumber={order?.tableNumber}
          onClose={() => setShowPayPicker(false)}
          onPayOrder={(num) => {
            setShowPayPicker(false);
            openPaymentModal(num);
          }}
          onPayAll={(nums) => {
            setShowPayPicker(false);
            openPaymentModal(nums);
          }}
        />
      )}

      {/* Dynamic UPI Payment Modal */}
      {showPaymentModal && paymentOrderNumbers?.length > 0 && (
        <UPIPaymentModal
          orderNumbers={paymentOrderNumbers}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentOrderNumbers(null);
          }}
          onSuccess={(updatedOrder) => {
            handlePaymentSuccess(updatedOrder);
            refreshOrders();
          }}
        />
      )}

    </div>
  );
}
