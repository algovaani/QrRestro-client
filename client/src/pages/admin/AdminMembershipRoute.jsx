import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminMembershipPage from './AdminMembershipPage';

export default function AdminMembershipRoute({ standalone = false }) {
  const { user } = useAuth();

  if (!user || user.role !== 'Admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return <AdminMembershipPage standalone={standalone} />;
}
