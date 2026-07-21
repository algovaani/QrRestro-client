import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import AdminMembershipRoute from './AdminMembershipRoute';
import MembershipWaitingPage from './MembershipWaitingPage';
import NotificationToasts from '../../components/common/NotificationToasts';
import { canAccessMembershipPage } from '../../utils/membershipAccess';
import { UserX, LogOut } from 'lucide-react';

export default function SubscriptionExpiredPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications, removeNotification } = useSocket();

  if (canAccessMembershipPage(user)) {
    return (
      <>
        <AdminMembershipRoute standalone />
        <NotificationToasts
          notifications={notifications}
          removeNotification={removeNotification}
          onNavigate={(path) => navigate(path)}
        />
      </>
    );
  }

  if (user?.isActive === false) {
    return (
      <div className="membership-standalone-wrap">
        <div className="membership-waiting">
          <div className="membership-waiting-icon">
            <UserX size={40} color="#dc2626" />
          </div>
          <h2>Account Band Hai</h2>
          <p>
            Super Admin ne aapka account band kar diya hai.
            <br />
            Membership renew ka offer aane ka wait karein ya Super Admin se contact karein.
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

  return <MembershipWaitingPage standalone />;
}
