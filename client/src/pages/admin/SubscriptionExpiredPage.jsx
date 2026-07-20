import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminMembershipRoute from './AdminMembershipRoute';
import MembershipWaitingPage from './MembershipWaitingPage';
import { canAccessMembershipPage } from '../../utils/membershipAccess';
import { UserX, LogOut } from 'lucide-react';

export default function SubscriptionExpiredPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (user?.isActive === false) {
    return (
      <div className="membership-standalone-wrap">
        <div className="membership-waiting">
          <div className="membership-waiting-icon">
            <UserX size={40} color="#dc2626" />
          </div>
          <h2>Account Deactivated</h2>
          <p>
            Super Admin ne aapka account deactivate kar diya hai.
            <br />
            Dashboard access ke liye Super Admin se contact karein.
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

  if (!canAccessMembershipPage(user)) {
    return <MembershipWaitingPage standalone />;
  }

  return <AdminMembershipRoute standalone />;
}
