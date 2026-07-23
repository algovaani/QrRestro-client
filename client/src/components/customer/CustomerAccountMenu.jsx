import React, { useState } from 'react';
import { User, Phone, UtensilsCrossed, LogOut, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';

function maskMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length !== 10) return mobile || '';
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export default function CustomerAccountMenu({ tableNumber, onAfterLogout }) {
  const { customerMobile, customerName, logoutCustomer } = useCart();
  const [open, setOpen] = useState(false);

  if (!customerMobile) return null;

  const displayName = customerName?.trim() || 'Guest';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    setOpen(false);
    logoutCustomer();
    if (onAfterLogout) onAfterLogout();
  };

  return (
    <>
      <button
        type="button"
        className="customer-account-trigger"
        onClick={() => setOpen(true)}
        aria-label="My account"
      >
        <span className="customer-account-trigger__avatar">{initial}</span>
        <span className="customer-account-trigger__label">Account</span>
      </button>

      {open && (
        <div className="customer-account-overlay" onClick={() => setOpen(false)} role="presentation">
          <div
            className="customer-account-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-account-title"
          >
            <div className="customer-account-sheet__handle" aria-hidden="true" />

            <div className="customer-account-sheet__header">
              <h2 id="customer-account-title" className="customer-account-sheet__title">My Account</h2>
              <button
                type="button"
                className="customer-account-sheet__close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="customer-account-sheet__profile">
              <div className="customer-account-sheet__avatar">{initial}</div>
              <div>
                <div className="customer-account-sheet__name">{displayName}</div>
                <div className="customer-account-sheet__subtitle">Logged in on this phone</div>
              </div>
            </div>

            <div className="customer-account-sheet__details">
              <div className="customer-account-sheet__row">
                <Phone size={16} />
                <div>
                  <span className="customer-account-sheet__row-label">Mobile</span>
                  <span className="customer-account-sheet__row-value">{maskMobile(customerMobile)}</span>
                </div>
              </div>
              {tableNumber && (
                <div className="customer-account-sheet__row">
                  <UtensilsCrossed size={16} />
                  <div>
                    <span className="customer-account-sheet__row-label">Table</span>
                    <span className="customer-account-sheet__row-value">Table {tableNumber}</span>
                  </div>
                </div>
              )}
            </div>

            <p className="customer-account-sheet__note">
              Logout to use a different mobile number on this table.
            </p>

            <button type="button" className="customer-account-sheet__logout" onClick={handleLogout}>
              <LogOut size={18} />
              Logout &amp; Switch Number
            </button>
          </div>
        </div>
      )}
    </>
  );
}
