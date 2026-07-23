import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Phone, UtensilsCrossed, LogOut, X, Check, AlertCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function CustomerAccountMenu({ tableNumber, onAfterLogout, onSaved }) {
  const { customerMobile, customerName, customerDetailsComplete, updateCustomerProfile, logoutCustomer } = useCart();
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditName(customerName?.trim() || '');
    setEditMobile(customerMobile || '');
    setErrorMsg('');
    setSavedMsg('');
  }, [open, customerName, customerMobile]);

  useEffect(() => {
    if (!savedMsg) return undefined;
    const timer = setTimeout(() => setSavedMsg(''), 2500);
    return () => clearTimeout(timer);
  }, [savedMsg]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('customer-account-open');
    return () => document.body.classList.remove('customer-account-open');
  }, [open]);

  if (!customerDetailsComplete) return null;

  const displayName = (editName || customerName || 'Guest').trim() || 'Guest';
  const initial = displayName.charAt(0).toUpperCase();

  const handleSave = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const result = updateCustomerProfile(editName, editMobile);
    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }
    setSavedMsg('Profile updated');
    if (onSaved) onSaved();
  };

  const handleLogout = () => {
    setOpen(false);
    logoutCustomer();
    if (onAfterLogout) onAfterLogout();
  };

  const sheet = open ? (
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
            <div className="customer-account-sheet__subtitle">Edit name &amp; mobile below</div>
          </div>
        </div>

        <form className="customer-account-form" onSubmit={handleSave}>
          <div className="customer-account-form__field">
            <label htmlFor="customer-account-name">
              <User size={14} /> Full Name
            </label>
            <input
              id="customer-account-name"
              type="text"
              required
              placeholder="Enter your name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="customer-account-form__input"
            />
          </div>

          <div className="customer-account-form__field">
            <label htmlFor="customer-account-mobile">
              <Phone size={14} /> Mobile Number
            </label>
            <input
              id="customer-account-mobile"
              type="tel"
              required
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
              value={editMobile}
              onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, ''))}
              className="customer-account-form__input"
            />
          </div>

          {tableNumber && (
            <div className="customer-account-sheet__row customer-account-sheet__row--static">
              <UtensilsCrossed size={16} />
              <div>
                <span className="customer-account-sheet__row-label">Table</span>
                <span className="customer-account-sheet__row-value">Table {tableNumber}</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="customer-account-form__error">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedMsg && (
            <div className="customer-account-form__success">
              <Check size={15} />
              <span>{savedMsg}</span>
            </div>
          )}

          <button type="submit" className="customer-account-form__save">
            <Check size={18} />
            Save Changes
          </button>
        </form>

        <button type="button" className="customer-account-sheet__logout" onClick={handleLogout}>
          <LogOut size={18} />
          Logout &amp; Switch Number
        </button>
      </div>
    </div>
  ) : null;

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

      {sheet && createPortal(sheet, document.body)}
    </>
  );
}
