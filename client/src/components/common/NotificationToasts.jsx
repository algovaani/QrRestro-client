import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';

const getCardClass = (type) => {
  if (type === 'payment') return 'payment';
  if (type === 'payment_pending') return 'payment-pending';
  if (type === 'membership_activated' || type === 'membership_renewal_request' || type === 'membership_offer_sent' || type === 'membership_renewal_rejected') {
    return 'membership';
  }
  return 'order';
};

/** Auto popup when new notification arrives (list stays in bell panel until dismissed) */
export default function NotificationToasts({ notifications, removeNotification, onViewOrder, onNavigate }) {
  const [popupIds, setPopupIds] = useState([]);
  const prevCountRef = useRef(notifications.length);

  useEffect(() => {
    if (notifications.length > prevCountRef.current && notifications[0]) {
      const latestId = notifications[0].id;
      setPopupIds((prev) => [latestId, ...prev.filter((id) => id !== latestId)].slice(0, 2));
      const timer = setTimeout(() => {
        setPopupIds((prev) => prev.filter((id) => id !== latestId));
      }, 8000);
      prevCountRef.current = notifications.length;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = notifications.length;
  }, [notifications]);

  const popupNotifications = notifications.filter((n) => popupIds.includes(n.id));
  if (!popupNotifications.length) return null;

  return createPortal(
    <div className="admin-notifications admin-notifications--popup" role="alert" aria-live="polite">
      {popupNotifications.map((n) => (
        <div key={n.id} className={`admin-notification-card ${getCardClass(n.type)}`}>
          <div className="admin-notification-header">
            <span className="admin-notification-title">{n.title}</span>
            <button
              type="button"
              className="admin-notification-close"
              onClick={() => {
                setPopupIds((prev) => prev.filter((id) => id !== n.id));
              }}
              aria-label="Dismiss popup"
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
                setPopupIds((prev) => prev.filter((id) => id !== n.id));
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
                setPopupIds((prev) => prev.filter((id) => id !== n.id));
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
    </div>,
    document.body
  );
}
