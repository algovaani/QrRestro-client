import React from 'react';
import { X, ArrowRight, Bell } from 'lucide-react';

const getCardClass = (type) => {
  if (type === 'payment') return 'payment';
  if (type === 'payment_pending') return 'payment-pending';
  if (type === 'membership_activated' || type === 'membership_renewal_request' || type === 'membership_offer_sent' || type === 'membership_renewal_rejected') {
    return 'membership';
  }
  return 'order';
};

export default function NotificationPanel({
  notifications,
  removeNotification,
  onViewOrder,
  onNavigate,
  onClose
}) {
  return (
    <div className="admin-notifications-panel" role="dialog" aria-label="Notifications">
      <div className="admin-notifications-panel-header">
        <span>
          <Bell size={16} /> Notifications ({notifications.length})
        </span>
        <button type="button" className="admin-notification-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="admin-notifications-panel-empty">Koi notification nahi hai</div>
      ) : (
        <div className="admin-notifications-panel-list">
          {notifications.map((n) => (
            <div key={n.id} className={`admin-notification-card ${getCardClass(n.type)}`}>
              <div className="admin-notification-header">
                <span className="admin-notification-title">{n.title}</span>
                <button
                  type="button"
                  className="admin-notification-close"
                  onClick={() => removeNotification(n.id)}
                  aria-label="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="admin-notification-message">{n.message}</p>

              {n.timestamp && (
                <div className="admin-notification-time">
                  {new Date(n.timestamp).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              )}

              {n.order && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm admin-notification-action"
                  onClick={() => {
                    removeNotification(n.id);
                    onViewOrder?.();
                  }}
                >
                  <span>View Order Details</span>
                  <ArrowRight size={14} />
                </button>
              )}

              {n.actionPath && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm admin-notification-action"
                  onClick={() => {
                    removeNotification(n.id);
                    onNavigate?.(n.actionPath);
                  }}
                >
                  <span>
                    {n.type === 'membership_renewal_request'
                      ? 'View Requests'
                      : n.type === 'membership_offer_sent'
                        ? 'View Membership'
                        : n.type === 'membership_renewal_rejected'
                          ? 'Retry Membership'
                          : 'Open Dashboard'}
                  </span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
