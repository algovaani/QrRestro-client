import React from 'react';
import { Wifi } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import NotificationToasts from './NotificationToasts';
import AdminNotificationBell from './AdminNotificationBell';

export default function Header({ title }) {
  const { notifications, removeNotification, isConnected } = useSocket();
  const navigate = useNavigate();

  return (
    <>
      <header className="admin-header">
        <h2 className="admin-header-title">{title}</h2>

        <div className="admin-header-actions">
          <div
            className={`admin-header-sync${isConnected ? ' is-connected' : ' is-disconnected'}`}
            title={isConnected ? 'Real-time orders connected' : 'Reconnecting… refresh page if this persists'}
          >
            <Wifi size={16} />
            <span>{isConnected ? 'Live Sync' : 'Offline'}</span>
          </div>

          <AdminNotificationBell
            onViewOrder={() => navigate('/admin/orders')}
            onNavigate={(path) => navigate(path)}
          />
        </div>
      </header>

      <NotificationToasts
        notifications={notifications}
        removeNotification={removeNotification}
        onViewOrder={() => navigate('/admin/orders')}
        onNavigate={(path) => navigate(path)}
      />
    </>
  );
}
