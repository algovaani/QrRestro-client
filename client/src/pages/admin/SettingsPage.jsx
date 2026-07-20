import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import UpiQrDisplay from '../../components/common/UpiQrDisplay';
import { Save, Building, QrCode } from 'lucide-react';

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    restaurantName: '',
    upiId: '',
    address: '',
    mobile: '',
    gstNumber: '',
    taxPercentage: 5,
    currency: '₹',
    openingTime: '',
    closingTime: '',
    soundNotification: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await API.get('/settings');
      if (res.data.success && res.data.setting) {
        const s = res.data.setting;
        setFormData({
          restaurantName: s.restaurantName || '',
          upiId: s.upiId || '',
          address: s.address || '',
          mobile: s.mobile || '',
          gstNumber: s.gstNumber || '',
          taxPercentage: s.taxPercentage ?? 5,
          currency: s.currency || '₹',
          openingTime: s.openingTime || '',
          closingTime: s.closingTime || '',
          soundNotification: s.soundNotification !== false
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      const res = await API.put('/settings', formData);

      if (res.data.success) {
        setMessage('Settings saved! UPI ID se QR automatically generate hoga.');
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <div className="admin-main">
          <Header title="Settings & UPI" />
          <div className="admin-content" style={{ padding: '2rem' }}>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Settings & UPI" />
        <div className="admin-content">

          <div style={{ maxWidth: '720px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={20} color="var(--primary)" /> Restaurant & Payment Settings
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Sirf UPI ID enter karein — customer payment ke liye QR automatically ban jayega.
            </p>

            {message && (
              <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Restaurant Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.restaurantName}
                    onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: 'var(--primary)' }}>
                    UPI ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. restaurant@upi"
                    value={formData.upiId}
                    onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                    style={{ width: '100%', borderColor: 'var(--primary)', background: '#fff0e6' }}
                  />
                </div>
              </div>

              <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
                  <QrCode size={18} color="var(--primary)" />
                  Auto UPI QR Code (UPI ID se generate)
                </label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Customer order pay karte waqt isi UPI ID se amount ke saath dynamic QR banega.
                </p>
                <UpiQrDisplay
                  upiId={formData.upiId}
                  payeeName={formData.restaurantName || 'Restaurant'}
                  amount={1}
                  note="Preview"
                  size={180}
                />
                {formData.upiId && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
                    UPI: <strong>{formData.upiId}</strong>
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Address</label>
                <textarea
                  rows="2"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Contact Mobile</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>GST Number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>GST Tax (%)</label>
                  <input
                    type="number"
                    value={formData.taxPercentage}
                    onChange={(e) => setFormData({ ...formData, taxPercentage: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Opening Time</label>
                  <input
                    type="text"
                    value={formData.openingTime}
                    onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>Closing Time</label>
                  <input
                    type="text"
                    value={formData.closingTime}
                    onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.soundNotification}
                    onChange={(e) => setFormData({ ...formData, soundNotification: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Enable sound notification on new order
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.5rem' }}>
                <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
