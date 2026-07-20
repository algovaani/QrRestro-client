import React from 'react';
import { Bell, Wifi } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import NotificationToasts from './NotificationToasts';

export default function Header({ title }) {
  const { notifications, removeNotification } = useSocket();
  const navigate = useNavigate();

  return (
    <>
      <header className="admin-header">
        <h2 className="admin-header-title">{title}</h2>

        <div className="admin-header-actions">
          <div className="admin-header-sync">
            <Wifi size={16} />
            <span>Live Sync</span>
          </div>

          <div className={`admin-header-bell${notifications.length > 0 ? ' has-notifications' : ''}`}>
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="admin-header-badge">{notifications.length}</span>
            )}
          </div>
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
