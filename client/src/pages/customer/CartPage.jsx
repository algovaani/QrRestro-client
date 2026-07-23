import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCart, getCustomerMenuPath, getCustomerCartPath } from '../../context/CartContext';
import { getSavedCustomerMobile } from '../../utils/customerSession';
import API from '../../services/api';
import CustomerAccountMenu from '../../components/customer/CustomerAccountMenu';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import MyOrdersModal from '../../components/customer/MyOrdersModal';
import UPIPaymentModal from '../../components/customer/UPIPaymentModal';
import { useTableSessionOrders } from '../../hooks/useTableSessionOrders';
import { startCustomerPayFlow, getUnpaidOrders } from '../../utils/customerPayFlow';
import { unlockOrderChimeAudio } from '../../utils/orderChime';
import PayOrderPickerModal from '../../components/customer/PayOrderPickerModal';
import { ArrowLeft, Trash2, Plus, Minus, CheckCircle, AlertCircle, User, QrCode, Banknote } from 'lucide-react';

export default function CartPage() {
  const navigate = useNavigate();
  const { adminId: routeAdminId, tableNumber: routeTableNumber } = useParams();
  const {
    tableNumber,
    restaurantAdminId,
    initTableCart,
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    customerName,
    updateCustomerName,
    customerMobile,
    customerDetailsComplete,
    specialNote,
    setSpecialNote,
    restaurantSettings,
    applyRestaurantSettings
  } = useCart();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [payOrderNumbers, setPayOrderNumbers] = useState(null);
  const [showPayPicker, setShowPayPicker] = useState(false);

  const activeAdminId = restaurantAdminId || routeAdminId || '';
  const activeTableNumber = routeTableNumber || tableNumber || '';
  const menuPath = getCustomerMenuPath(activeAdminId, activeTableNumber);
  const hasTableContext = Boolean(activeTableNumber);

  useEffect(() => {
    if (routeAdminId && routeTableNumber) {
      initTableCart(routeTableNumber, routeAdminId);
    }
  }, [routeAdminId, routeTableNumber]);

  useEffect(() => {
    if (!customerDetailsComplete && menuPath && activeAdminId) {
      const saved = getSavedCustomerMobile(activeAdminId, activeTableNumber);
      if (!saved) {
        navigate(menuPath, { replace: true });
      }
    }
  }, [customerDetailsComplete, menuPath, navigate, activeAdminId]);

  useEffect(() => {
    if (!activeAdminId || !activeTableNumber) return;

    let cancelled = false;
    const loadTaxSettings = async () => {
      try {
        const menuUrl = `/public/menu/${activeAdminId}/table/${activeTableNumber}`;
        const res = await API.get(menuUrl);
        if (!cancelled && res.data.success) {
          const setting = res.data.setting || res.data.settings;
          if (setting) applyRestaurantSettings(setting);
        }
      } catch {
        /* keep last known or default tax */
      }
    };

    loadTaxSettings();
    return () => { cancelled = true; };
  }, [activeAdminId, activeTableNumber, applyRestaurantSettings]);

  const { orders, refreshOrders } = useTableSessionOrders(
    customerDetailsComplete ? activeAdminId : '',
    activeTableNumber,
    customerMobile
  );

  const handlePayClick = () => {
    startCustomerPayFlow(orders, activeTableNumber, {
      setPayOrderNumbers,
      setShowPayPicker
    });
  };

  useEffect(() => {
    if (activeTableNumber && !customerDetailsComplete && menuPath) {
      navigate(menuPath);
    }
  }, [activeTableNumber, activeAdminId, customerDetailsComplete, menuPath, navigate]);

  const taxPercentage = Number(restaurantSettings?.taxPercentage) || 5;
  const tax = Math.round((subtotal * taxPercentage) / 100);
  const grandTotal = subtotal + tax;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activeTableNumber) {
      setErrorMsg('Table number is missing. Please scan table QR code again.');
      return;
    }
    if (cartItems.length === 0) {
      setErrorMsg('Your cart is empty. Please add items from menu.');
      return;
    }

    // MANDATORY CUSTOMER VALIDATION
    const cleanMobile = customerMobile ? customerMobile.trim() : '';
    if (!cleanMobile || cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit Mobile Number before confirming order.');
      return;
    }
    const cleanName = customerName ? customerName.trim() : '';
    if (!cleanName) {
      setErrorMsg('Please enter your name before confirming order.');
      return;
    }

    unlockOrderChimeAudio();
    setLoading(true);

    try {
      const payload = {
        tableNumber: activeTableNumber,
        adminId: activeAdminId,
        customerName: cleanName,
        customerMobile: cleanMobile,
        items: cartItems.map(item => ({
          menuItemId: item.menuItemId,
          itemName: item.itemName,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          instructions: item.instructions || ''
        })),
        notes: specialNote || '',
        paymentMethod
      };

      const res = await API.post('/public/orders', payload);
      if (res.data.success) {
        const orderNumber = res.data.order.orderNumber;
        clearCart();
        navigate(`/order-success/${orderNumber}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to place order. Please check customer details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customer-mobile-wrap" style={{ background: '#f8fafc' }}>
      
      {/* Top Bar */}
      <div style={{ background: '#ffffff', padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 80 }}>
        <button
          onClick={() => (menuPath ? navigate(menuPath) : navigate(-1))}
          style={{ padding: '0.4rem', borderRadius: '50%', background: '#f1f5f9', flexShrink: 0 }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)' }}>Cart & Checkout</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Table {activeTableNumber || 'N/A'}</span>
        </div>
        {customerDetailsComplete && (
          <CustomerAccountMenu
            tableNumber={activeTableNumber}
            onAfterLogout={() => {
              if (menuPath) navigate(menuPath);
            }}
          />
        )}
      </div>

      <div style={{ padding: '1rem' }}>
        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.85rem', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid #fca5a5' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: '600' }}>{errorMsg}</span>
          </div>
        )}

        {/* Cart Items List */}
        {cartItems.length > 0 ? (
          <form onSubmit={handlePlaceOrder}>
            
            {/* 1. MANDATORY CUSTOMER DETAILS CARD */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '2px solid var(--primary)', padding: '1.15rem', marginBottom: '1rem', boxShadow: '0 4px 12px rgba(255,107,0,0.08)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.85rem' }}>
                <User size={18} color="var(--primary)" /> Customer Information
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem', color: 'var(--secondary)' }}>
                    Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => updateCustomerName(e.target.value)}
                    style={{ width: '100%', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>Mobile:</strong> {customerMobile}
                </div>
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem', color: 'var(--secondary)' }}>
                  Special Table Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bring extra water glasses"
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* 2. ORDER ITEMS CARD */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--secondary)' }}>
                Ordered Items ({cartItems.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cartItems.map((item) => (
                  <div key={item.cartKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--secondary)' }}>
                        {item.itemName}
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.4rem' }}>
                          {item.size}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        ₹{item.price} per item
                      </div>
                      {item.instructions && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                          Note: "{item.instructions}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>
                        ₹{item.price * item.quantity}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
                        <button type="button" onClick={() => updateQuantity(item.cartKey, item.quantity - 1)} style={{ padding: '0.1rem' }}>
                          <Minus size={14} />
                        </button>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.cartKey, item.quantity + 1)} style={{ padding: '0.1rem' }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. PAYMENT OPTION */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
                Payment Option
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                    border: `2px solid ${paymentMethod === 'UPI' ? 'var(--primary)' : 'var(--border)'}`,
                    background: paymentMethod === 'UPI' ? '#fff7ed' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <QrCode size={22} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--secondary)' }}>UPI QR Scan & Pay Online</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      After ordering, scan the QR with PhonePe / GPay to pay
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                    border: `2px solid ${paymentMethod === 'Cash' ? 'var(--primary)' : 'var(--border)'}`,
                    background: paymentMethod === 'Cash' ? '#fff7ed' : '#fff',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <Banknote size={22} color="var(--secondary)" />
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--secondary)' }}>Pay Cash at Counter</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Pay cash at the table — no QR needed
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. BILL SUMMARY */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
                Bill Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Item Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>GST Tax ({taxPercentage}%)</span>
                  <span>₹{tax}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem', marginTop: '0.4rem' }}>
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--primary)' }}>₹{grandTotal}</span>
                </div>
              </div>
            </div>

            {/* SUBMIT PLACE ORDER BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary pulse-button"
              style={{ width: '100%', padding: '0.95rem', fontSize: '1rem', borderRadius: '14px' }}
            >
              {loading ? 'Placing Order...' : `Place Order • ₹${grandTotal}`}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#fff', borderRadius: '16px' }}>
            <div style={{ fontSize: '3rem' }}>🛒</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0.5rem 0' }}>Your cart is empty</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {hasTableContext
                ? 'Add items from the menu to place an order.'
                : 'Please scan the QR code on your table to open the digital menu.'}
            </p>
            {menuPath ? (
              <button onClick={() => navigate(menuPath)} className="btn btn-primary">
                Browse Digital Menu
              </button>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Scan the table QR code from your phone camera to continue.
              </div>
            )}
          </div>
        )}
      </div>

      <CustomerBottomNav
        activeTab="cart"
        onMyOrders={() => setShowMyOrdersModal(true)}
        onPay={handlePayClick}
        ordersCount={orders.length}
      />

      {showMyOrdersModal && activeTableNumber && activeAdminId && (
        <MyOrdersModal
          tableNumber={activeTableNumber}
          adminId={activeAdminId}
          customerMobile={customerMobile}
          onClose={() => setShowMyOrdersModal(false)}
          onOrderMore={() => setShowMyOrdersModal(false)}
        />
      )}

      {showPayPicker && (
        <PayOrderPickerModal
          orders={getUnpaidOrders(orders)}
          allOrders={orders}
          tableNumber={activeTableNumber}
          onClose={() => setShowPayPicker(false)}
          onPayOrder={(num) => {
            setShowPayPicker(false);
            setPayOrderNumbers([num]);
          }}
          onPayAll={(nums) => {
            setShowPayPicker(false);
            setPayOrderNumbers(nums);
          }}
        />
      )}

      {payOrderNumbers?.length > 0 && (
        <UPIPaymentModal
          orderNumbers={payOrderNumbers}
          onClose={() => setPayOrderNumbers(null)}
          onSuccess={() => {
            setPayOrderNumbers(null);
            refreshOrders();
          }}
        />
      )}
    </div>
  );
}
