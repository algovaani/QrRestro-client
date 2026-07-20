import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Home, ShoppingBag, ReceiptText, QrCode } from 'lucide-react';
import { useCart, getCustomerMenuPath, getCustomerCartPath, loadActiveTableContext } from '../../context/CartContext';
import { useTableSessionOrders, getPayOrderNumber } from '../../hooks/useTableSessionOrders';

function isCartPath(pathname) {
  return pathname === '/cart' || pathname.endsWith('/cart');
}

function isMenuPath(pathname) {
  return pathname.includes('/menu/') && pathname.includes('/table/') && !isCartPath(pathname);
}

/**
 * @param {'menu'|'cart'|'orders'|'pay'} [activeTab] — highlight override on order pages
 */
export default function CustomerBottomNav({
  activeTab: activeTabProp = 'menu',
  onMyOrders,
  onPay,
  ordersCount: ordersCountProp
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminId: routeAdminId, tableNumber: routeTableNumber } = useParams();

  const {
    tableNumber: cartTable,
    restaurantAdminId,
    totalItemsCount,
    subtotal,
    customerMobile,
    customerDetailsComplete
  } = useCart();

  const saved = loadActiveTableContext();
  const adminId = routeAdminId || restaurantAdminId || saved?.adminId || '';
  const tableNumber = routeTableNumber || cartTable || saved?.tableNumber || '';

  const menuPath = getCustomerMenuPath(adminId, tableNumber);
  const cartPath = getCustomerCartPath(adminId, tableNumber);

  const onCartPage = isCartPath(location.pathname);
  const onMenuPage = isMenuPath(location.pathname);
  const activeTab = onCartPage ? 'cart' : onMenuPage ? 'menu' : activeTabProp;

  const { orders, ordersCount: hookOrdersCount } = useTableSessionOrders(
    customerDetailsComplete ? adminId : '',
    tableNumber,
    customerMobile
  );
  const ordersCount = ordersCountProp ?? hookOrdersCount;

  const goMenu = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onMenuPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (menuPath) {
      navigate(menuPath);
    }
  };

  const goCart = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onCartPage) {
      return;
    }

    if (cartPath) {
      navigate(cartPath);
    }
  };

  const handleMyOrders = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onMyOrders) {
      onMyOrders();
      return;
    }
    if (menuPath) navigate(menuPath, { state: { openOrders: true } });
  };

  const handlePay = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onPay) {
      onPay();
      return;
    }
    const payNum = getPayOrderNumber(orders);
    if (payNum) {
      if (menuPath) navigate(menuPath, { state: { openPay: true, payOrderNumber: payNum } });
      return;
    }
    alert(`No active order yet for Table ${tableNumber || ''}. Please place an order first.`);
  };

  const tabStyle = (tab) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '0.7rem',
    padding: '0.4rem 0',
    background: activeTab === tab ? 'rgba(255,107,0,0.25)' : 'transparent',
    borderRadius: '10px',
    position: 'relative',
    border: activeTab === tab ? '1px solid rgba(255,107,0,0.45)' : '1px solid transparent',
    minHeight: '52px'
  });

  return (
    <nav className="sticky-cart-bar customer-bottom-nav" aria-label="Customer navigation">
      <button type="button" onClick={goMenu} style={tabStyle('menu')} aria-current={activeTab === 'menu' ? 'page' : undefined}>
        <Home size={18} color={activeTab === 'menu' ? 'var(--primary)' : '#fff'} />
        <span style={{ marginTop: '0.2rem', fontWeight: '600' }}>Menu</span>
      </button>

      <button type="button" onClick={goCart} style={tabStyle('cart')} aria-current={activeTab === 'cart' ? 'page' : undefined}>
        <ShoppingBag size={18} color={activeTab === 'cart' || totalItemsCount > 0 ? 'var(--primary)' : '#fff'} />
        <span style={{ marginTop: '0.2rem', fontWeight: '600' }}>
          Cart{subtotal > 0 ? ` (₹${subtotal})` : ''}
        </span>
        {totalItemsCount > 0 && (
          <span className="customer-bottom-nav__badge">{totalItemsCount}</span>
        )}
      </button>

      <button type="button" onClick={handleMyOrders} style={tabStyle('orders')} aria-current={activeTab === 'orders' ? 'page' : undefined}>
        <ReceiptText size={18} color={activeTab === 'orders' ? 'var(--primary)' : '#38bdf8'} />
        <span style={{ marginTop: '0.2rem', fontWeight: '600' }}>My Orders</span>
        {ordersCount > 0 && (
          <span className="customer-bottom-nav__badge customer-bottom-nav__badge--blue">{ordersCount}</span>
        )}
      </button>

      <button
        type="button"
        onClick={handlePay}
        style={{
          ...tabStyle('pay'),
          background: activeTab === 'pay'
            ? 'linear-gradient(135deg, #ff6b00 0%, #e05d00 100%)'
            : 'linear-gradient(135deg, rgba(255,107,0,0.85) 0%, rgba(224,93,0,0.85) 100%)',
          borderRadius: '12px',
          fontWeight: '800'
        }}
        aria-current={activeTab === 'pay' ? 'page' : undefined}
      >
        <QrCode size={18} color="#fff" />
        <span style={{ marginTop: '0.2rem' }}>Pay</span>
      </button>
    </nav>
  );
}
