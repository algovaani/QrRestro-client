import React from 'react';
import { createPortal } from 'react-dom';
import { BellRing, X } from 'lucide-react';

export default function CustomerNotificationToast({ message, onDismiss, aboveNav = true }) {
  if (!message) return null;

  return createPortal(
    <div
      className={`customer-notifications${aboveNav ? ' customer-notifications--above-nav' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="customer-notification-card">
        <BellRing size={22} className="customer-notification-icon pulse-button" />
        <p className="customer-notification-message">{message}</p>
        {onDismiss && (
          <button
            type="button"
            className="customer-notification-close"
            onClick={onDismiss}
            aria-label="Dismiss notification"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
