import React, { useState } from 'react';
import { Phone, UtensilsCrossed, AlertCircle } from 'lucide-react';

export default function CustomerWelcome({ tableNumber, restaurantName, onSubmit }) {
  const [mobile, setMobile] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!mobile || mobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    onSubmit(mobile.trim());
  };

  return (
    <div className="customer-mobile-wrap customer-welcome-wrap">
      <div className="customer-welcome-card">
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div className="customer-welcome-icon">
            <UtensilsCrossed size={28} color="var(--primary)" />
          </div>
          <h1 className="customer-welcome-title">
            Welcome to {restaurantName || 'Our Restaurant'}
          </h1>
          <p className="customer-welcome-subtitle">
            Table {tableNumber} • Enter mobile number to start ordering
          </p>
        </div>

        {errorMsg && (
          <div className="customer-welcome-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="customer-welcome-form">
          <div>
            <label className="customer-welcome-label">
              Mobile Number <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="tel"
                required
                autoFocus
                inputMode="numeric"
                maxLength="10"
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                className="customer-welcome-input"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary customer-welcome-submit">
            Continue to Menu
          </button>
        </form>

        <p className="customer-welcome-note">
          No OTP needed. Your number is saved on this phone for next visit.
        </p>
      </div>
    </div>
  );
}
