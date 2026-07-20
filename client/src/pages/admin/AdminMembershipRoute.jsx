import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessMembershipPage } from '../../utils/membershipAccess';
import AdminMembershipPage from './AdminMembershipPage';
import MembershipWaitingPage from './MembershipWaitingPage';

export default function AdminMembershipRoute({ standalone = false }) {
  const { user } = useAuth();

  if (!canAccessMembershipPage(user)) {
    if (standalone) {
      return <MembershipWaitingPage standalone />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <AdminMembershipPage standalone={standalone} />;
}
