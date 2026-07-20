import { useAuth } from '../../context/AuthContext';
import AdminMembershipRoute from './AdminMembershipRoute';
import MembershipWaitingPage from './MembershipWaitingPage';
import { canAccessMembershipPage } from '../../utils/membershipAccess';

export default function SubscriptionExpiredPage() {
  const { user } = useAuth();

  if (!canAccessMembershipPage(user)) {
    return <MembershipWaitingPage standalone />;
  }

  return <AdminMembershipRoute standalone />;
}
