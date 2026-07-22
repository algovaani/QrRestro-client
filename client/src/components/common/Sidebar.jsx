import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminLayout } from '../../context/AdminLayoutContext';
import { LayoutDashboard, ShoppingCart, Utensils, Grid, QrCode, BarChart3, Settings, LogOut, ChefHat, CreditCard, X, Menu } from 'lucide-react';
import { canShowMembershipOption } from '../../utils/membershipAccess';
import { resolveMembershipDisplay, getMembershipDaysLabel } from '../../utils/membershipDays';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { sidebarOpen, closeSidebar, toggleSidebar } = useAdminLayout();

  const handleLogout = () => {
    closeSidebar();
    logout();
    navigate('/admin/login');
  };

  const membership = resolveMembershipDisplay(user);
  const showMembershipDays = user?.role === 'Admin' && user?.isActive !== false;

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Close menu"
        />
      )}

      <aside className={`admin-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-brand-icon">🍽️</div>
          <div>
            <h3>Royal Spice</h3>
            <span>Admin Portal</span>
          </div>
          <button type="button" className="admin-sidebar-close" onClick={closeSidebar} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          <NavLink to="/admin/dashboard" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/admin/orders" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <ShoppingCart size={18} />
            <span>Orders</span>
          </NavLink>

          <NavLink to="/admin/kitchen" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <ChefHat size={18} />
            <span>Kitchen Screen</span>
          </NavLink>

          <NavLink to="/admin/menu" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Utensils size={18} />
            <span>Menu Items</span>
          </NavLink>

          <NavLink to="/admin/categories" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Grid size={18} />
            <span>Categories</span>
          </NavLink>

          <NavLink to="/admin/tables" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <QrCode size={18} />
            <span>Tables & QR Codes</span>
          </NavLink>

          <NavLink to="/admin/reports" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={18} />
            <span>Sales Reports</span>
          </NavLink>

          <NavLink to="/admin/settings" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Settings & UPI</span>
          </NavLink>

          {canShowMembershipOption(user) && (
            <NavLink to="/admin/membership" onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <CreditCard size={18} />
              <span>Buy / Renew Membership</span>
              {user?.renewalRequested && (
                <span className="sidebar-membership-badge">!</span>
              )}
            </NavLink>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{user?.name || 'Administrator'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-word' }}>{user?.email || 'admin@restaurant.com'}</div>
            {showMembershipDays && (
              <div style={{
                marginTop: '0.35rem',
                fontSize: '0.7rem',
                fontWeight: '700',
                color: membership.daysRemaining <= 3 ? 'var(--danger)' : 'var(--primary)'
              }}>
                {membership.planName} • {getMembershipDaysLabel(membership.daysRemaining)}
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', color: 'var(--danger)' }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export function AdminMobileMenuButton() {
  const { toggleSidebar } = useAdminLayout();
  return (
    <button type="button" className="admin-mobile-menu-btn" onClick={toggleSidebar} aria-label="Open menu">
      <Menu size={22} />
    </button>
  );
}
