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

// Customer Pages
import CustomerMenu from './pages/customer/CustomerMenu';
import CartPage from './pages/customer/CartPage';
import OrderSuccessPage from './pages/customer/OrderSuccessPage';
import OrderStatusPage from './pages/customer/OrderStatusPage';

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles, allowExpired = false }) => {
  const { user, token } = useAuth();
  if (!token || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Super Admin bypasses expired checks and goes straight to Super Admin Dashboard
  if (user.role === 'SuperAdmin') {
    return children;
  }

  // Check Expiry / Active Status for Restaurant Admin
  if (user.role === 'Admin' && !allowExpired) {
    const expiry = user.subscriptionEndsAt || user.trialEndsAt;
    const isExpired = (user.planStatus === 'Expired') ||
      (expiry && new Date(expiry) < new Date());

    if (!user.isActive || isExpired) {
      return <Navigate to="/subscription-expired" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SocketProvider>
          <BrowserRouter>
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
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/kitchen"
                element={
                  <ProtectedRoute allowedRoles={['Admin', 'Kitchen']}>
                    <KitchenScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tables"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <TablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <CategoriesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/menu"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <MenuPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <SettingsPage />
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
              <Route path="*" element={<Navigate to="/admin/login" replace />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </CartProvider>
    </AuthProvider>
  );
}
