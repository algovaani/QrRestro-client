import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import NotificationPanel from './NotificationPanel';

export default function AdminNotificationBell({ onViewOrder, onNavigate }) {
  const { notifications, removeNotification } = useSocket();
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!panelOpen) return;

    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  return (
    <div className="admin-header-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`admin-header-bell${notifications.length > 0 ? ' has-notifications' : ''}${panelOpen ? ' is-open' : ''}`}
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={panelOpen}
      >
        <Bell size={18} />
        {notifications.length > 0 && (
          <span className="admin-header-badge">{notifications.length}</span>
        )}
      </button>

      {panelOpen && (
        <NotificationPanel
          notifications={notifications}
          removeNotification={removeNotification}
          onViewOrder={() => {
            setPanelOpen(false);
            onViewOrder?.();
          }}
          onNavigate={(path) => {
            setPanelOpen(false);
            onNavigate?.(path);
          }}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
