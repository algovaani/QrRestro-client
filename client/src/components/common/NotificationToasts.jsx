import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';

export default function NotificationToasts({ notifications, removeNotification, onViewOrder, onNavigate }) {
  if (!notifications.length) return null;

  const visibleNotifications = notifications.slice(0, 2);

  const getCardClass = (type) => {
    if (type === 'payment') return 'payment';
    if (type === 'payment_pending') return 'payment-pending';
    if (type === 'membership_activated' || type === 'membership_renewal_request' || type === 'membership_offer_sent') return 'membership';
    return 'order';
  };

  return createPortal(
    <div className="admin-notifications" role="alert" aria-live="polite">
      {visibleNotifications.map((n) => (
        <div
          key={n.id}
          className={`admin-notification-card ${getCardClass(n.type)}`}
        >
          <div className="admin-notification-header">
            <span className="admin-notification-title">{n.title}</span>
            <button
              type="button"
              className="admin-notification-close"
              onClick={() => removeNotification(n.id)}
              aria-label="Dismiss notification"
            >
              <X size={18} />
            </button>
          </div>

          <p className="admin-notification-message">{n.message}</p>

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
              <span>{n.type === 'membership_renewal_request' ? 'View Requests' : n.type === 'membership_offer_sent' ? 'View Membership' : 'Open Dashboard'}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}
