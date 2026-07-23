import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import API from '../../services/api';
import { useCart } from '../../context/CartContext';
import MyOrdersModal from '../../components/customer/MyOrdersModal';
import CustomerWelcome from '../../components/customer/CustomerWelcome';
import UPIPaymentModal from '../../components/customer/UPIPaymentModal';
import CustomerBottomNav from '../../components/customer/CustomerBottomNav';
import { startCustomerPayFlow, getUnpaidOrders } from '../../utils/customerPayFlow';
import PayOrderPickerModal from '../../components/customer/PayOrderPickerModal';
import { Search, Plus, Minus, X, AlertCircle, Clock, Utensils, ReceiptText } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useTableRoomSocket } from '../../hooks/useTableRoomSocket';
import { useLivePolling, useSocketReconnectRefetch } from '../../hooks/useLivePolling';
import { getRestaurantRoom } from '../../utils/socketUrl';
import CustomerNotificationToast from '../../components/customer/CustomerNotificationToast';
import { getOrderStatusMessage, mobilesMatch, vibrateCustomerAlert } from '../../utils/orderNotifications';
import { resolveUploadUrl } from '../../utils/uploadUrl';

export default function CustomerMenu() {
  const { adminId: routeAdminId, tableNumber } = useParams();
  const location = useLocation();

  const [tableInfo, setTableInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [foodTypeFilter, setFoodTypeFilter] = useState('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Active orders for this table session
  const [tableOrders, setTableOrders] = useState([]);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [payOrderNumbers, setPayOrderNumbers] = useState(null);
  const [showPayPicker, setShowPayPicker] = useState(false);
  const [statusToast, setStatusToast] = useState('');

  // Modal State for Item Selection
  const [selectedItem, setSelectedItem] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedSize, setSelectedSize] = useState('Full');
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  const { initTableCart, bindRestaurantAdmin, addToCart, saveCustomerDetails, customerDetailsComplete, customerMobile, restaurantAdminId, applyRestaurantSettings, logoutCustomer } = useCart();
  const { socket, playOrderChime } = useSocket();

  useEffect(() => {
    if (tableNumber) {
      if (routeAdminId) {
        initTableCart(tableNumber, routeAdminId);
      }
      fetchMenuData(routeAdminId);
    }
  }, [tableNumber, routeAdminId]);

  useEffect(() => {
    if (tableNumber && restaurantAdminId && customerDetailsComplete && customerMobile) {
      fetchActiveTableOrders();
    } else {
      setTableOrders([]);
    }
  }, [tableNumber, restaurantAdminId, customerDetailsComplete, customerMobile]);

  useEffect(() => {
    if (!statusToast) return undefined;
    const timer = setTimeout(() => setStatusToast(''), 8000);
    return () => clearTimeout(timer);
  }, [statusToast]);

  useTableRoomSocket(
    socket,
    restaurantAdminId,
    tableNumber,
    customerDetailsComplete
      ? {
          onNewOrder: (newOrder) => {
            if (!mobilesMatch(newOrder.customerMobile, customerMobile)) return;
            setTableOrders((prev) => {
              if (prev.some((o) => String(o._id) === String(newOrder._id))) return prev;
              return [newOrder, ...prev];
            });
          },
          onStatusUpdate: (updatedOrder) => {
            if (!mobilesMatch(updatedOrder.customerMobile, customerMobile)) return;
            playOrderChime();
            vibrateCustomerAlert();
            setStatusToast(getOrderStatusMessage(updatedOrder));
            setTableOrders((prev) => {
              const exists = prev.some((o) => String(o._id) === String(updatedOrder._id));
              if (!exists) return prev;
              return prev.map((o) =>
                String(o._id) === String(updatedOrder._id) ? updatedOrder : o
              );
            });
          },
          onPaymentPending: (updatedOrder) => {
            if (!mobilesMatch(updatedOrder.customerMobile, customerMobile)) return;
            setStatusToast(`⏳ Payment submitted for Order #${updatedOrder.orderNumber} — waiting for admin approval`);
            setTableOrders((prev) =>
              prev.map((o) =>
                String(o._id) === String(updatedOrder._id) ? updatedOrder : o
              )
            );
          },
          onPaymentSuccess: (updatedOrder) => {
            if (!mobilesMatch(updatedOrder.customerMobile, customerMobile)) return;
            playOrderChime();
            vibrateCustomerAlert();
            setStatusToast(`💳 Payment approved for Order #${updatedOrder.orderNumber}!`);
            setTableOrders((prev) =>
              prev.map((o) =>
                String(o._id) === String(updatedOrder._id) ? updatedOrder : o
              )
            );
          }
        }
      : {}
  );

  const fetchMenuData = async (adminIdParam) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const menuUrl = adminIdParam
        ? `/public/menu/${adminIdParam}/table/${tableNumber}`
        : `/public/menu/${tableNumber}`;
      const res = await API.get(menuUrl);
      if (res.data.success) {
        const resolvedAdminId = res.data.adminId || adminIdParam || res.data.table?.adminId;
        if (resolvedAdminId) {
          bindRestaurantAdmin(resolvedAdminId);
        }
        const setting = res.data.setting || res.data.settings;
        if (setting) {
          applyRestaurantSettings(setting);
        }
        setTableInfo({
          tableNumber: res.data.tableNumber || tableNumber,
          settings: setting
        });
        setCategories(res.data.categories || []);
        setMenuItems(res.data.menuItems || []);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid Table QR Code. Please scan a valid restaurant table QR.');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTableOrders = async () => {
    if (!customerMobile || !restaurantAdminId) return;
    try {
      const res = await API.get(`/public/orders/table/${restaurantAdminId}/${tableNumber}/active`, {
        params: { customerMobile }
      });
      if (res.data.success) {
        setTableOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useSocketReconnectRefetch(
    socket,
    fetchActiveTableOrders,
    Boolean(restaurantAdminId && tableNumber && customerDetailsComplete && customerMobile)
  );

  useLivePolling(
    fetchActiveTableOrders,
    12000,
    Boolean(restaurantAdminId && tableNumber && customerDetailsComplete && customerMobile)
  );

  // Join restaurant room for settings/menu updates from admin
  useEffect(() => {
    const adminId = restaurantAdminId || routeAdminId;
    if (!socket || !adminId) return undefined;
    const room = getRestaurantRoom(adminId);
    const join = () => socket.emit('join_room', room);
    join();
    socket.on('connect', join);

    const onSettingsUpdated = (data) => {
      applyRestaurantSettings(data);
      setStatusToast('Restaurant settings updated — tax & details refreshed');
    };

    socket.on('settings_updated', onSettingsUpdated);
    return () => {
      socket.off('connect', join);
      socket.off('settings_updated', onSettingsUpdated);
      socket.emit('leave_room', room);
    };
  }, [socket, restaurantAdminId, routeAdminId, applyRestaurantSettings]);

  const handleOpenItemModal = (item) => {
    setSelectedItem(item);
    setQuantity(1);
    setInstructions('');

    if (item.priceType === 'Only Half') {
      setSelectedSize('Half');
    } else if (item.priceType === 'Only Full' || item.priceType === 'Full and Half') {
      setSelectedSize('Full');
    } else {
      setSelectedSize('Fixed');
    }
  };

  const formatItemPrice = (item) => {
    if (item.priceType === 'Full and Half') return `₹${item.halfPrice} / ₹${item.fullPrice}`;
    if (item.priceType === 'Only Half') return `₹${item.halfPrice}`;
    if (item.priceType === 'Only Full') return `₹${item.fullPrice}`;
    return `₹${item.fixedPrice}`;
  };

  const openImagePreview = (item) => {
    if (!item?.image) return;
    setSelectedItem(null);
    setImagePreview(item);
  };

  const handleMenuRowClick = (e, item) => {
    if (e.target.closest('[data-menu-image-trigger]')) return;
    handleOpenItemModal(item);
  };

  const handleAddToCartConfirm = () => {
    if (!selectedItem) return;

    let price = 0;
    if (selectedSize === 'Half') price = selectedItem.halfPrice;
    else if (selectedSize === 'Full') price = selectedItem.fullPrice;
    else price = selectedItem.fixedPrice;

    addToCart(selectedItem, selectedSize, quantity, price, instructions);
    setSelectedItem(null);
  };

  useEffect(() => {
    if (!location.state) return;
    if (location.state.openOrders) setShowMyOrdersModal(true);
    if (location.state.openPayPicker) setShowPayPicker(true);
    if (location.state.openPay) {
      startCustomerPayFlow(tableOrders, tableNumber, {
        setPayOrderNumbers,
        setShowPayPicker,
        alertFn: (msg) => alert(msg)
      });
    }
  }, [location.state, tableOrders, tableNumber]);

  const handleDirectPayClick = () => {
    startCustomerPayFlow(tableOrders, tableNumber, {
      setPayOrderNumbers,
      setShowPayPicker,
      alertFn: (msg) => alert(msg)
    });
  };

  // Filter menu items
  const filteredItems = (menuItems || []).filter(item => {
    const categoryId = item.category?._id ?? item.category;
    const matchesCategory =
      activeCategory === 'all' || String(categoryId) === String(activeCategory);
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    const matchesFoodType = foodTypeFilter === 'all' || item.foodType === foodTypeFilter;
    return matchesCategory && matchesSearch && matchesFoodType;
  });

  if (loading) {
    return (
      <div className="customer-mobile-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🍽️</div>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading Digital Menu...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="customer-mobile-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', background: '#fff', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <AlertCircle size={48} color="var(--danger)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Invalid Table QR</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{errorMsg}</p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Please scan the QR Code placed on your table standee.</div>
        </div>
      </div>
    );
  }

  if (!customerDetailsComplete) {
    return (
      <CustomerWelcome
        tableNumber={tableNumber}
        restaurantName={tableInfo?.settings?.restaurantName}
        onSubmit={saveCustomerDetails}
      />
    );
  }

  return (
    <div className="customer-mobile-wrap" style={{ paddingBottom: '75px' }}>
      <CustomerNotificationToast
        message={statusToast}
        onDismiss={() => setStatusToast('')}
        aboveNav
      />

      {/* Customer Mobile Top Bar */}
      <div className="customer-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--secondary)' }}>
              {tableInfo?.settings?.restaurantName || 'Royal Spice'}
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Digital QR Menu
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            <div style={{
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              padding: '0.35rem 0.85rem',
              borderRadius: '99px',
              fontSize: '0.85rem',
              fontWeight: '800',
              border: '1px solid #ffd6bc'
            }}>
              Table {tableNumber}
            </div>
            {customerMobile && (
              <button type="button" className="customer-logout-btn" onClick={logoutCustomer}>
                Logout ({customerMobile})
              </button>
            )}
          </div>
        </div>

        {/* Active Order Tracker Callout */}
        {tableOrders.length > 0 && (
          <div
            onClick={() => setShowMyOrdersModal(true)}
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '0.55rem 0.85rem',
              borderRadius: '12px',
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ReceiptText size={16} color="#059669" />
              <span>{tableOrders.length} Order Round(s) Placed at Table {tableNumber}</span>
            </div>
            <span style={{ fontWeight: '800', color: 'var(--primary)' }}>My Orders →</span>
          </div>
        )}

        {/* Search Bar */}
        <div style={{ position: 'relative', marginTop: '0.75rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search Paneer, Naan, Biryani..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
          />
        </div>

        {/* Category Horizontal Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0 0 0', scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '99px',
              fontSize: '0.8rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              background: activeCategory === 'all' ? 'var(--primary)' : '#f1f5f9',
              color: activeCategory === 'all' ? '#fff' : 'var(--secondary)'
            }}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => setActiveCategory(String(cat._id))}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                background: String(activeCategory) === String(cat._id) ? 'var(--primary)' : '#f1f5f9',
                color: String(activeCategory) === String(cat._id) ? '#fff' : 'var(--secondary)'
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List Body */}
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredItems.map(item => (
            <div
              key={item._id}
              onClick={(e) => handleMenuRowClick(e, item)}
              style={{
                display: 'flex',
                gap: '0.85rem',
                padding: '0.85rem',
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                cursor: 'pointer'
              }}
            >
              {item.image ? (
                <button
                  type="button"
                  data-menu-image-trigger
                  aria-label={`View full photo of ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openImagePreview(item);
                  }}
                  style={{
                    flexShrink: 0,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'zoom-in',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={resolveUploadUrl(item.image)}
                    alt={item.name}
                    draggable={false}
                    style={{ width: '85px', height: '85px', borderRadius: '10px', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                  />
                </button>
              ) : (
                <div style={{ width: '85px', height: '85px', borderRadius: '10px', background: '#fff0e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0 }}>
                  🍲
                </div>
              )}

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span className={`badge ${item.foodType === 'Veg' ? 'badge-veg' : 'badge-nonveg'}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                      ● {item.foodType}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--secondary)', lineHeight: '1.2' }}>
                    {item.name}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.9rem' }}>
                    {item.priceType === 'Full and Half' ? `₹${item.halfPrice} / ₹${item.fullPrice}` :
                     item.priceType === 'Only Half' ? `₹${item.halfPrice}` :
                     item.priceType === 'Only Full' ? `₹${item.fullPrice}` : `₹${item.fixedPrice}`}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItemModal(item);
                    }}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              No dishes found matching your search.
            </div>
          )}
        </div>
      </div>

      <CustomerBottomNav
        activeTab="menu"
        onMyOrders={() => setShowMyOrdersModal(true)}
        onPay={handleDirectPayClick}
        ordersCount={tableOrders.length}
      />

      {/* Full-size dish image preview */}
      {imagePreview && (
        <div
          className="modal-overlay image-preview-overlay"
          onClick={() => setImagePreview(null)}
        >
          <div
            className="menu-image-preview-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="menu-image-preview-close"
              onClick={() => setImagePreview(null)}
              aria-label="Close image"
            >
              <X size={18} />
            </button>

            <div className="menu-image-preview-media">
              <img
                src={resolveUploadUrl(imagePreview.image)}
                alt={imagePreview.name}
              />
            </div>

            <div className="menu-image-preview-body">
              <span className={`badge ${imagePreview.foodType === 'Veg' ? 'badge-veg' : 'badge-nonveg'}`} style={{ fontSize: '0.7rem' }}>
                ● {imagePreview.foodType}
              </span>
              <h3>{imagePreview.name}</h3>
              {imagePreview.description && (
                <p className="menu-image-preview-desc">{imagePreview.description}</p>
              )}
              <div className="menu-image-preview-footer">
                <span className="menu-image-preview-price">{formatItemPrice(imagePreview)}</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const item = imagePreview;
                    setImagePreview(null);
                    handleOpenItemModal(item);
                  }}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} /> Add to order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Variant / Half vs Full Modal */}
      {selectedItem && !imagePreview && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ borderRadius: '20px' }}>
            {selectedItem.image && (
              <button
                type="button"
                data-menu-image-trigger
                aria-label={`View full photo of ${selectedItem.name}`}
                onClick={() => openImagePreview(selectedItem)}
                style={{
                  width: '100%',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'zoom-in',
                  marginBottom: '0.85rem',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                <img
                  src={resolveUploadUrl(selectedItem.image)}
                  alt={selectedItem.name}
                  draggable={false}
                  style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                />
              </button>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span className={`badge ${selectedItem.foodType === 'Veg' ? 'badge-veg' : 'badge-nonveg'}`} style={{ fontSize: '0.7rem' }}>
                  ● {selectedItem.foodType}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--secondary)', marginTop: '0.2rem' }}>
                  {selectedItem.name}
                </h3>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{ background: '#f1f5f9', padding: '0.3rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            {/* Size Options Picker */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Select Portion Size
              </label>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {(selectedItem.priceType === 'Full and Half' || selectedItem.priceType === 'Only Half') && (
                  <div
                    onClick={() => setSelectedSize('Half')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: `2px solid ${selectedSize === 'Half' ? 'var(--primary)' : 'var(--border)'}`,
                      background: selectedSize === 'Half' ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Half Portion</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.2rem' }}>₹{selectedItem.halfPrice}</div>
                  </div>
                )}

                {(selectedItem.priceType === 'Full and Half' || selectedItem.priceType === 'Only Full') && (
                  <div
                    onClick={() => setSelectedSize('Full')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: `2px solid ${selectedSize === 'Full' ? 'var(--primary)' : 'var(--border)'}`,
                      background: selectedSize === 'Full' ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Full Portion</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.2rem' }}>₹{selectedItem.fullPrice}</div>
                  </div>
                )}

                {selectedItem.priceType === 'Single Fixed Price' && (
                  <div
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '2px solid var(--primary)',
                      background: 'var(--primary-light)',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>Standard Portion</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.2rem' }}>₹{selectedItem.fixedPrice}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Quantity Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Quantity</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f1f5f9', padding: '0.35rem 0.75rem', borderRadius: '10px' }}>
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ padding: '0.2rem' }}>
                  <Minus size={16} />
                </button>
                <span style={{ fontWeight: '800', fontSize: '1rem', minWidth: '20px', textAlign: 'center' }}>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} style={{ padding: '0.2rem' }}>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Special Instructions */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                Special Cooking Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Less spicy, Extra butter, No onion"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            {/* Confirm Add Button */}
            <button
              onClick={handleAddToCartConfirm}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', borderRadius: '12px' }}
            >
              Add Item to Order • ₹{(
                (selectedSize === 'Half' ? selectedItem.halfPrice :
                 selectedSize === 'Full' ? selectedItem.fullPrice : selectedItem.fixedPrice) * quantity
              )}
            </button>
          </div>
        </div>
      )}

      {/* MY ORDERS MODAL */}
      {showMyOrdersModal && (
        <MyOrdersModal
          tableNumber={tableNumber}
          adminId={restaurantAdminId}
          customerMobile={customerMobile}
          onClose={() => setShowMyOrdersModal(false)}
          onOrderMore={() => setShowMyOrdersModal(false)}
        />
      )}

      {showPayPicker && (
        <PayOrderPickerModal
          orders={getUnpaidOrders(tableOrders)}
          allOrders={tableOrders}
          tableNumber={tableNumber}
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

      {/* DYNAMIC UPI PAYMENT MODAL */}
      {payOrderNumbers?.length > 0 && (
        <UPIPaymentModal
          orderNumbers={payOrderNumbers}
          onClose={() => setPayOrderNumbers(null)}
          onSuccess={() => {
            setPayOrderNumbers(null);
            fetchActiveTableOrders();
          }}
        />
      )}

    </div>
  );
}
