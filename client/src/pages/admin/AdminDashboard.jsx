import React, { useEffect, useState, useCallback } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useSocket } from '../../context/SocketContext';
import { useLivePolling } from '../../hooks/useLivePolling';
import {
  QrCode,
  UtensilsCrossed,
  FolderKanban,
  ShoppingBag,
  Clock,
  ChefHat,
  CheckCircle2,
  TrendingUp,
  IndianRupee,
  ArrowRight,
  CreditCard,
  Calendar,
  Filter
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canShowMembershipOption } from '../../utils/membershipAccess';
import { formatExpiryDate, getMembershipDaysLabel, resolveMembershipDisplay } from '../../utils/membershipDays';

const toLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isOrderInDateRange = (order, start, end) => {
  if (!start || !end || !order?.createdAt) return true;
  const orderDate = new Date(order.createdAt);
  const startD = new Date(start);
  startD.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(23, 59, 59, 999);
  return orderDate >= startD && orderDate <= endD;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // DATE FILTER STATES
  const [filterPreset, setFilterPreset] = useState('today');
  const [startDate, setStartDate] = useState(toLocalDateStr(new Date()));
  const [endDate, setEndDate] = useState(toLocalDateStr(new Date()));

  const [stats, setStats] = useState({
    totalTables: 0,
    totalMenuItems: 0,
    totalCategories: 0,
    totalOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    completedOrders: 0,
    todayOrders: 0,
    todayRevenue: 0,
    totalRevenue: 0
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const { socket, isConnected } = useSocket();

  const fetchDashboardData = useCallback(async (sDate, eDate, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { startDate: sDate, endDate: eDate };
      const [statsRes, recentRes, topRes] = await Promise.all([
        API.get('/dashboard/stats', { params }),
        API.get('/dashboard/recent-orders', { params }),
        API.get('/dashboard/top-items', { params })
      ]);

      if (statsRes.data.success) {
        setStats(prev => ({
          ...prev,
          ...statsRes.data.stats,
          todayRevenue: statsRes.data.stats.todayRevenue || statsRes.data.stats.totalRevenue || 0,
          todayOrders: statsRes.data.stats.todayOrders || statsRes.data.stats.totalOrders || 0
        }));
      }
      if (recentRes.data.success) setRecentOrders(recentRes.data.recentOrders || []);
      if (topRes.data.success) setTopItems(topRes.data.topSellingItems || topRes.data.topItems || []);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useLivePolling(
    () => fetchDashboardData(startDate, endDate, true),
    20000,
    Boolean(startDate && endDate)
  );

  useEffect(() => {
    handlePresetChange('today');
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchDashboardData(startDate, endDate);
    }
  }, [startDate, endDate, fetchDashboardData]);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      if (!isOrderInDateRange(newOrder, startDate, endDate)) return;

      setRecentOrders(prev => {
        if (prev.some(o => String(o._id) === String(newOrder._id))) return prev;
        return [newOrder, ...prev].slice(0, 10);
      });

      setStats(prev => ({
        ...prev,
        totalOrders: (prev.totalOrders || 0) + 1,
        todayOrders: (prev.todayOrders || 0) + 1,
        pendingOrders: (prev.pendingOrders || 0) + 1
      }));
    };

    const handleStatusUpdate = (updatedOrder) => {
      setRecentOrders(prev => {
        const exists = prev.some(o => String(o._id) === String(updatedOrder._id));
        if (!exists && isOrderInDateRange(updatedOrder, startDate, endDate)) {
          return [updatedOrder, ...prev].slice(0, 10);
        }
        return prev.map(o => String(o._id) === String(updatedOrder._id) ? updatedOrder : o);
      });
      fetchDashboardData(startDate, endDate, true);
    };

    const handlePaymentPending = (updatedOrder) => {
      setRecentOrders((prev) => {
        const exists = prev.some((o) => String(o._id) === String(updatedOrder._id));
        if (!exists && isOrderInDateRange(updatedOrder, startDate, endDate)) {
          return [updatedOrder, ...prev].slice(0, 10);
        }
        return prev.map((o) => String(o._id) === String(updatedOrder._id) ? updatedOrder : o);
      });
    };

    const handlePaymentSuccess = (updatedOrder) => {
      setRecentOrders(prev => prev.map(o => String(o._id) === String(updatedOrder._id) ? updatedOrder : o));
      fetchDashboardData(startDate, endDate, true);
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);
    socket.on('payment_pending', handlePaymentPending);
    socket.on('payment_success', handlePaymentSuccess);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
      socket.off('payment_pending', handlePaymentPending);
      socket.off('payment_success', handlePaymentSuccess);
    };
  }, [socket, startDate, endDate, fetchDashboardData]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReconnect = () => {
      fetchDashboardData(startDate, endDate, true);
    };

    socket.on('connect', handleReconnect);
    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket, isConnected, startDate, endDate, fetchDashboardData]);

  const handlePresetChange = (preset) => {
    setFilterPreset(preset);
    const today = new Date();

    if (preset === 'today') {
      const dateStr = toLocalDateStr(today);
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const dateStr = toLocalDateStr(yest);
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'last7') {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 6);
      setStartDate(toLocalDateStr(last7));
      setEndDate(toLocalDateStr(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toLocalDateStr(firstDay));
      setEndDate(toLocalDateStr(today));
    }
  };

  const revenueDisplay = (stats.todayRevenue || stats.totalRevenue || 0).toLocaleString();
  const ordersDisplay = stats.todayOrders || stats.totalOrders || 0;
  const membership = resolveMembershipDisplay(user);
  const membershipActive = user?.isActive !== false && user?.planStatus !== 'Expired' && membership.daysRemaining > 0;

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Dashboard Overview" />
        <div className="admin-content">

          {membershipActive && (
            <div
              className="admin-membership-banner"
              style={{
                background: membership.daysRemaining <= 3 ? '#fff7ed' : '#f0fdf4',
                borderColor: membership.daysRemaining <= 3 ? '#fdba74' : '#86efac'
              }}
            >
              <div>
                <strong>
                  {membership.planName} — {getMembershipDaysLabel(membership.daysRemaining)}
                </strong>
                <p>
                  Valid till <strong>{formatExpiryDate(membership.expiryDate)}</strong>
                  {membership.daysRemaining <= 3 && ' • Jaldi renew karein!'}
                </p>
              </div>
              <Link to="/admin/membership" className="btn btn-primary btn-sm">
                <CreditCard size={14} /> Membership
              </Link>
            </div>
          )}

          {canShowMembershipOption(user) && (
            <div className={`admin-membership-banner ${user?.renewalRequested ? 'admin-membership-banner--pending' : 'admin-membership-banner--warning'}`}>
              <div>
                <strong>
                  {user?.renewalRequested
                    ? `Membership request pending — ${user?.requestedPlanName || 'Renewal'}`
                    : `Super Admin ne membership offer bheja — ${user?.membershipOfferPlanName || 'Renew karein'}`}
                </strong>
                <p>
                  {user?.renewalRequested
                    ? 'Super Admin payment verify karke activate karenge.'
                    : 'Neeche membership page se plan select karke payment karein.'}
                </p>
              </div>
              <Link to="/admin/membership" className="btn btn-primary btn-sm">
                <CreditCard size={14} /> View Membership
              </Link>
            </div>
          )}

          {/* DATE FILTER BAR */}
          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', fontWeight: '800', fontSize: '0.95rem' }}>
                <Calendar size={18} color="var(--primary)" />
                <span>Date Range Filter</span>
              </div>

              {/* Preset Selector Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handlePresetChange('today')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    background: filterPreset === 'today' ? 'var(--primary)' : '#f1f5f9',
                    color: filterPreset === 'today' ? '#fff' : 'var(--secondary)'
                  }}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('yesterday')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    background: filterPreset === 'yesterday' ? 'var(--primary)' : '#f1f5f9',
                    color: filterPreset === 'yesterday' ? '#fff' : 'var(--secondary)'
                  }}
                >
                  Yesterday
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('last7')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    background: filterPreset === 'last7' ? 'var(--primary)' : '#f1f5f9',
                    color: filterPreset === 'last7' ? '#fff' : 'var(--secondary)'
                  }}
                >
                  Last 7 Days
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('thisMonth')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    background: filterPreset === 'thisMonth' ? 'var(--primary)' : '#f1f5f9',
                    color: filterPreset === 'thisMonth' ? '#fff' : 'var(--secondary)'
                  }}
                >
                  This Month
                </button>

                <button
                  type="button"
                  onClick={() => setFilterPreset('custom')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    background: filterPreset === 'custom' ? 'var(--primary)' : '#f1f5f9',
                    color: filterPreset === 'custom' ? '#fff' : 'var(--secondary)'
                  }}
                >
                  Custom Range
                </button>
              </div>

              {/* Custom Date Inputs */}
              {filterPreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  />
                </div>
              )}

            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Updating Dashboard Metrics...</div>
          ) : (
            <>
              {/* Primary Interactive Stats Grid */}
              <div className="stats-grid">
                
                {/* 1. Today Revenue Card */}
                <div
                  onClick={() => navigate('/admin/reports')}
                  className="stat-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Period Revenue</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.2rem' }}>₹{revenueDisplay}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>View Reports →</span>
                  </div>
                  <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
                    <IndianRupee size={22} />
                  </div>
                </div>

                {/* 2. Today Orders Card */}
                <div
                  onClick={() => navigate('/admin/orders')}
                  className="stat-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Period Orders</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.2rem' }}>{ordersDisplay}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>View All Orders →</span>
                  </div>
                  <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                    <ShoppingBag size={22} />
                  </div>
                </div>

                {/* 3. Pending Orders Card */}
                <div
                  onClick={() => navigate('/admin/orders?status=New')}
                  className="stat-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Pending Orders</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.2rem', color: stats.pendingOrders > 0 ? 'var(--primary)' : 'inherit' }}>
                      {stats.pendingOrders || 0}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>View Pending Orders Only →</span>
                  </div>
                  <div className="stat-icon" style={{ background: '#fff0e6', color: 'var(--primary)' }}>
                    <Clock size={22} />
                  </div>
                </div>

                {/* 4. Preparing Kitchen Card */}
                <div
                  onClick={() => navigate('/admin/orders?status=Preparing')}
                  className="stat-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Preparing (Kitchen)</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.2rem' }}>{stats.preparingOrders || 0}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>View Preparing Orders →</span>
                  </div>
                  <div className="stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                    <ChefHat size={22} />
                  </div>
                </div>

              </div>

              {/* Secondary Interactive Stats Row */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                
                {/* 5. Total Tables Card */}
                <div
                  onClick={() => navigate('/admin/tables')}
                  className="stat-card"
                  style={{ padding: '1rem', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Tables</div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{stats.totalTables || 0}</h4>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700' }}>Manage QR Cards →</span>
                  </div>
                  <QrCode size={20} color="var(--primary)" />
                </div>

                {/* 6. Menu Items Card */}
                <div
                  onClick={() => navigate('/admin/menu')}
                  className="stat-card"
                  style={{ padding: '1rem', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Menu Items</div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{stats.totalMenuItems || 0}</h4>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700' }}>Manage Menu →</span>
                  </div>
                  <UtensilsCrossed size={20} color="var(--primary)" />
                </div>

                {/* 7. Categories Card */}
                <div
                  onClick={() => navigate('/admin/categories')}
                  className="stat-card"
                  style={{ padding: '1rem', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categories</div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{stats.totalCategories || 0}</h4>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700' }}>Manage Categories →</span>
                  </div>
                  <FolderKanban size={20} color="var(--primary)" />
                </div>

                {/* 8. Completed Orders Card */}
                <div
                  onClick={() => navigate('/admin/orders?status=Completed')}
                  className="stat-card"
                  style={{ padding: '1rem', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed</div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{stats.completedOrders || 0}</h4>
                    <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: '700' }}>View Completed Only →</span>
                  </div>
                  <CheckCircle2 size={20} color="var(--success)" />
                </div>

              </div>

              {/* Main Two Column Tables Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginTop: '1rem' }}>
                
                {/* Clickable Recent Orders List */}
                <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Recent Orders</h3>
                    <Link to="/admin/orders" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      View All <ArrowRight size={14} />
                    </Link>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <th style={{ padding: '0.6rem 0' }}>ORDER ID</th>
                        <th style={{ padding: '0.6rem 0' }}>TABLE</th>
                        <th style={{ padding: '0.6rem 0' }}>ITEMS</th>
                        <th style={{ padding: '0.6rem 0' }}>TOTAL</th>
                        <th style={{ padding: '0.6rem 0' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map(order => (
                        <tr
                          key={order._id}
                          onClick={() => navigate('/admin/orders')}
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '0.8rem 0', fontWeight: '700', color: 'var(--primary)' }}>{order.orderNumber}</td>
                          <td style={{ padding: '0.8rem 0' }}>Table {order.tableNumber}</td>
                          <td style={{ padding: '0.8rem 0', color: 'var(--text-muted)' }}>
                            {order.items?.map(i => `${i.itemName} (${i.quantity})`).join(', ')}
                          </td>
                          <td style={{ padding: '0.8rem 0', fontWeight: '600' }}>₹{order.grandTotal}</td>
                          <td style={{ padding: '0.8rem 0' }}>
                            <span className={`badge badge-${order.orderStatus?.toLowerCase()}`}>
                              {order.orderStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No orders found for selected date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Clickable Most Ordered Items List */}
                <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                      🔥 Top Selling Items
                    </h3>
                    <Link to="/admin/menu" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700' }}>
                      Menu →
                    </Link>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {topItems.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => navigate('/admin/menu')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', borderRadius: '10px', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--secondary)' }}>{item._id}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.totalQuantity} orders placed</div>
                        </div>
                        <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.9rem' }}>
                          ₹{item.totalRevenue}
                        </div>
                      </div>
                    ))}
                    {topItems.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                        Order analytics will display here.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
