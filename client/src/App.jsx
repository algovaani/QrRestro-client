import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SocketProvider } from './context/SocketContext';

// Super Admin Pages
import SuperAdminDashboard from './pages/superAdmin/SuperAdminDashboard';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import TablesPage from './pages/admin/TablesPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import MenuPage from './pages/admin/MenuPage';
import OrdersPage from './pages/admin/OrdersPage';
import KitchenScreen from './pages/admin/KitchenScreen';
import ReportsPage from './pages/admin/ReportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import SubscriptionExpiredPage from './pages/admin/SubscriptionExpiredPage';
import AdminMembershipRoute from './pages/admin/AdminMembershipRoute';
import { isAdminDashboardBlocked, getPostLoginPath } from './utils/adminAccess';
import { AdminLayoutProvider } from './context/AdminLayoutContext';

// Customer Pages
import CustomerMenu from './pages/customer/CustomerMenu';
import CartPage from './pages/customer/CartPage';
import OrderSuccessPage from './pages/customer/OrderSuccessPage';
import OrderStatusPage from './pages/customer/OrderStatusPage';

function PublicNotFound() {
  return (
    <div className="customer-mobile-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', background: '#fff', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', maxWidth: '360px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Scan your table QR code to open the digital menu.</p>
      </div>
    </div>
  );
}

function AppFallback() {
  const path = window.location.pathname;
  if (path.startsWith('/menu/') || path.startsWith('/cart') || path.startsWith('/order-')) {
    return <PublicNotFound />;
  }
  return <Navigate to="/admin/login" replace />;
}

function TenantScope({ children }) {
  const { user } = useAuth();
  return <React.Fragment key={user?._id || 'guest'}>{children}</React.Fragment>;
}

function AdminRoute({ children }) {
  return (
    <AdminLayoutProvider>
      <TenantScope>{children}</TenantScope>
    </AdminLayoutProvider>
  );
}

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles, allowExpired = false }) => {
  const { user, token, authReady } = useAuth();

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role === 'SuperAdmin') {
    if (allowedRoles?.includes('SuperAdmin')) return children;
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (user.role === 'Admin' && !allowExpired && isAdminDashboardBlocked(user)) {
    return <Navigate to="/subscription-expired" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getPostLoginPath(user)} replace />;
  }

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SocketProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public Customer QR Routes — cart route pehle (specific match) */}
              <Route path="/menu/:adminId/table/:tableNumber/cart" element={<CartPage />} />
              <Route path="/menu/:adminId/table/:tableNumber" element={<CustomerMenu />} />
              <Route path="/menu/table/:tableNumber" element={<CustomerMenu />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/order-success/:orderNumber" element={<OrderSuccessPage />} />
              <Route path="/order-status/:orderNumber" element={<OrderStatusPage />} />

              {/* Admin Auth Route */}
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* Subscription Expired Route */}
              <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />

              {/* Super Admin SaaS Control Portal */}
              <Route
                path="/super-admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['SuperAdmin']}>
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected Restaurant Admin Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <OrdersPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/kitchen"
                element={
                  <ProtectedRoute allowedRoles={['Admin', 'Kitchen']}>
                    <AdminRoute>
                      <KitchenScreen />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tables"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <TablesPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <CategoriesPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/menu"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <MenuPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <ReportsPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoute>
                      <SettingsPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/membership"
                element={
                  <ProtectedRoute allowedRoles={['Admin']} allowExpired>
                    <AdminMembershipRoute />
                  </ProtectedRoute>
                }
              />

              {/* Default Fallback */}
              <Route path="/" element={<Navigate to="/admin/login" replace />} />
              <Route path="*" element={<AppFallback />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </CartProvider>
    </AuthProvider>
  );
}
