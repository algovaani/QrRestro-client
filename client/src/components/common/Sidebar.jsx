import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, ShoppingCart, Utensils, Grid, QrCode, BarChart3, Settings, LogOut, ChefHat, CreditCard } from 'lucide-react';
import { canShowMembershipOption } from '../../utils/membershipAccess';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-sidebar">
      
      {/* Brand Logo */}
      <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.2rem' }}>
          🍽️
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', lineHeight: 1 }}>Royal Spice</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>Admin Portal</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        <NavLink to="/admin/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/admin/orders" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <ShoppingCart size={18} />
          <span>Orders Datatable</span>
        </NavLink>

        <NavLink to="/admin/kitchen" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <ChefHat size={18} />
          <span>Kitchen Screen</span>
        </NavLink>

        <NavLink to="/admin/menu" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Utensils size={18} />
          <span>Menu Items</span>
        </NavLink>

        <NavLink to="/admin/categories" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Grid size={18} />
          <span>Categories</span>
        </NavLink>

        <NavLink to="/admin/tables" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <QrCode size={18} />
          <span>Tables & QR Codes</span>
        </NavLink>

        <NavLink to="/admin/reports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <BarChart3 size={18} />
          <span>Sales Reports</span>
        </NavLink>

        <NavLink to="/admin/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings size={18} />
          <span>Settings & UPI</span>
        </NavLink>

        {canShowMembershipOption(user) && (
          <NavLink to="/admin/membership" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <CreditCard size={18} />
            <span>Buy / Renew Membership</span>
            {user?.renewalRequested && (
              <span className="sidebar-membership-badge">!</span>
            )}
          </NavLink>
        )}
      </nav>

      {/* Logout Profile Footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{user?.name || 'Administrator'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email || 'admin@restaurant.com'}</div>
          </div>
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

    </div>
  );
}
