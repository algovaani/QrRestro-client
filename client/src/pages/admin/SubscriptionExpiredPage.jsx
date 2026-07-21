import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import AdminMembershipPage from './AdminMembershipPage';
import NotificationToasts from '../../components/common/NotificationToasts';
import AdminNotificationBell from '../../components/common/AdminNotificationBell';
import { isAdminAccountLocked } from '../../utils/membershipAccess';
import { getPostLoginPath } from '../../utils/adminAccess';
import API from '../../services/api';
import { UserX, LogOut } from 'lucide-react';

export default function SubscriptionExpiredPage() {
  const { user, token, authReady, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { notifications, removeNotification } = useSocket();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;

    if (!token || !user) {
      navigate('/admin/login', { replace: true });
      return;
    }

    if (user.role !== 'Admin') {
      navigate(getPostLoginPath(user), { replace: true });
      return;
    }

    let cancelled = false;
    API.get('/auth/subscription-status')
      .then((res) => {
        if (!cancelled && res.data.success && res.data.user) {
          updateUser(res.data.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, [authReady, token, user, navigate, updateUser]);

  if (!authReady || !ready || !user) {
    return (
      <div className="membership-standalone-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading membership...</p>
      </div>
    );
  }

  if (isAdminAccountLocked(user)) {
    return (
      <div className="membership-standalone-wrap">
        <div className="membership-waiting">
          <div className="membership-waiting-icon">
            <UserX size={40} color="#dc2626" />
          </div>
          <h2>Account Deactivated</h2>
          <p>
            Super Admin has deactivated your account.
            <br />
            Ask them to send a membership offer or reactivate your account.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              logout();
              navigate('/admin/login', { replace: true });
            }}
          >
            <LogOut size={16} /> Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="membership-standalone-topbar">
        <AdminNotificationBell
          onViewOrder={() => navigate('/admin/orders')}
          onNavigate={(path) => navigate(path)}
        />
      </div>
      <AdminMembershipPage standalone />
      <NotificationToasts
        notifications={notifications}
        removeNotification={removeNotification}
        onNavigate={(path) => navigate(path)}
      />
    </>
  );
}
