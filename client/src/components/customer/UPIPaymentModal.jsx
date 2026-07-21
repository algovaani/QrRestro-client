import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { prepareQrForWhatsApp, getShareQrHint, isMobileDevice, openWhatsApp, buildPaymentQrShareMessage } from '../../utils/shareWhatsApp';
import { sendOrderBillOnWhatsApp } from '../../utils/billShare';
import { X, CheckCircle, ShieldCheck, Loader2, MessageSquare, Clock, AlertCircle, QrCode, FileText } from 'lucide-react';

export default function UPIPaymentModal({ orderNumber, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareHint, setShareHint] = useState('');
  const [paid, setPaid] = useState(false);
  const [pending, setPending] = useState(false);
  const [paidOrder, setPaidOrder] = useState(null);
  const [billMeta, setBillMeta] = useState(null);
  const [billSending, setBillSending] = useState(false);
  const [billHint, setBillHint] = useState('');
  const [error, setError] = useState('');

  const loadPaidOrder = useCallback(async () => {
    try {
      const res = await API.get(`/public/orders/${orderNumber}/status`);
      if (res.data.success) {
        setPaidOrder(res.data.order);
        setBillMeta({
          restaurantName: res.data.setting?.restaurantName || qrData?.restaurantName || 'Royal Spice Restaurant',
          taxLabel: `GST Tax (${res.data.setting?.taxPercentage ?? 5}%)`
        });
      }
    } catch {
      setError('Could not load paid order details.');
    }
  }, [orderNumber, qrData?.restaurantName]);

  useEffect(() => {
    fetchDynamicUPIQR();
  }, [orderNumber]);

  useEffect(() => {
    if (paid) {
      loadPaidOrder();
    }
  }, [paid, loadPaidOrder]);

  const fetchDynamicUPIQR = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get(`/payment/upi-qr/${orderNumber}`);
      if (res.data.success) {
        setQrData(res.data);
        if (res.data.paymentStatus === 'Paid') {
          setPaid(true);
        } else if (res.data.paymentStatus === 'Pending') {
          setPending(true);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate QR code. Ask the admin to set a UPI ID in settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await API.post('/payment/verify', {
        orderNumber,
        paymentMethod: 'UPI'
      });

      if (res.data.success) {
        if (res.data.pending || res.data.order?.paymentStatus === 'Pending') {
          setPending(true);
          if (onSuccess) onSuccess(res.data.order);
        } else {
          setPaid(true);
          if (res.data.order) {
            setPaidOrder(res.data.order);
          }
          if (res.data.bill) {
            setBillMeta(res.data.bill);
          }
          if (onSuccess) onSuccess(res.data.order);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareBillPdf = async () => {
    if (!paidOrder || billSending) return;

    setBillSending(true);
    setBillHint('');
    setError('');

    try {
      const result = await sendOrderBillOnWhatsApp(paidOrder, billMeta || {});
      if (result.cancelled) return;
      if (result.hint) {
        setBillHint(result.hint);
      }
    } catch {
      setError('Could not generate or share PDF bill. Please try again.');
    } finally {
      setBillSending(false);
    }
  };

  const handleShareQrWhatsApp = async (e) => {
    e?.preventDefault();
    if (!qrData?.qrCodeDataUrl || sharing) return;

    setSharing(true);
    setShareHint('');
    setError('');

    try {
      const shareMessage = buildPaymentQrShareMessage(qrData);
      const result = await prepareQrForWhatsApp({
        qrDataUrl: qrData.qrCodeDataUrl,
        filename: `payment-${qrData.orderNumber}.png`,
        message: shareMessage
      });
      const hint = getShareQrHint(result);
      if (hint) setShareHint(hint);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.method === 'cancelled') return;

      if (!isMobileDevice() && result.method !== 'share-file') {
        openWhatsApp(null, shareMessage);
      }
    } catch {
      setError('Could not share QR on WhatsApp. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card upi-payment-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', borderRadius: '24px', padding: '1.5rem', textAlign: 'center' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.9rem' }}>
            <ShieldCheck size={18} />
            <span>UPI QR Payment</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#f1f5f9', padding: '0.3rem', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 1rem' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Generating QR code...</p>
          </div>
        ) : error && !qrData && !paid ? (
          <div style={{ padding: '1.5rem 0.5rem' }}>
            <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.9rem', color: '#991b1b', marginBottom: '1rem' }}>{error}</p>
            <button type="button" onClick={fetchDynamicUPIQR} className="btn btn-primary" style={{ width: '100%', borderRadius: '12px' }}>
              Retry
            </button>
          </div>
        ) : paid ? (
          <div style={{ padding: '1.5rem 0.5rem' }}>
            <div style={{ width: '70px', height: '70px', background: '#dcfce7', color: '#15803d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <CheckCircle size={40} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--secondary)' }}>Payment Approved! 🎉</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
              Order #{orderNumber} is <strong>PAID</strong> and sent to kitchen.
            </p>

            {paidOrder ? (
              <button
                type="button"
                onClick={handleShareBillPdf}
                disabled={billSending}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '0.95rem',
                  borderRadius: '14px',
                  background: '#25D366',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginBottom: billHint ? '0.5rem' : '0.75rem',
                  boxShadow: '0 6px 16px rgba(37,211,102,0.3)',
                  border: 'none',
                  cursor: billSending ? 'not-allowed' : 'pointer',
                  opacity: billSending ? 0.7 : 1
                }}
              >
                {billSending ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                <span>{billSending ? 'Preparing PDF bill...' : 'Send PDF Bill on WhatsApp'}</span>
              </button>
            ) : (
              <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: '0.35rem' }} />
                Loading bill details...
              </div>
            )}

            {billHint && (
              <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.55rem 0.65rem', borderRadius: '10px', fontSize: '0.78rem', marginBottom: '0.75rem', lineHeight: 1.45, border: '1px solid #a7f3d0', textAlign: 'left' }}>
                {billHint}
              </div>
            )}

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.55rem', borderRadius: '10px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                {error}
              </div>
            )}

            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: '100%', borderRadius: '12px' }}>
              Close
            </button>
          </div>
        ) : pending ? (
          <div style={{ padding: '1.5rem 0.5rem' }}>
            <div style={{ width: '70px', height: '70px', background: '#fef3c7', color: '#b45309', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Clock size={40} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--secondary)' }}>Approval Pending ⏳</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              Payment submitted for order #{orderNumber}. The admin will verify and approve it.
            </p>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: '100%', borderRadius: '12px' }}>
              OK, Got It
            </button>
          </div>
        ) : qrData ? (
          <>
            <div style={{ background: '#fff0e6', borderRadius: '14px', padding: '0.75rem', marginBottom: '0.85rem', border: '1px solid #ffd6bc' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pay Amount</span>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.1' }}>
                ₹{qrData.grandTotal}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: '600', marginTop: '0.2rem' }}>
                Order #{qrData.orderNumber} • Table {qrData.tableNumber}
              </div>
            </div>

            <div className="upi-payment-steps">
              <span>1. QR Scan</span>
              <span>2. Pay in App</span>
              <span>3. Submit</span>
            </div>

            <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '20px', border: '2px solid var(--primary)', marginBottom: '0.85rem', boxShadow: '0 4px 16px rgba(255,107,0,0.08)' }}>
              {qrData.qrCodeDataUrl ? (
                <img
                  src={qrData.qrCodeDataUrl}
                  alt="UPI QR Code"
                  style={{ width: '240px', height: '240px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                />
              ) : (
                <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                  <QrCode size={48} style={{ margin: '0 auto 0.5rem' }} />
                  QR unavailable
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: '800', marginTop: '0.5rem' }}>
                Scan QR with PhonePe / GPay / Paytm
              </div>
            </div>

            <button
              type="button"
              onClick={handleShareQrWhatsApp}
              disabled={sharing || !qrData.qrCodeDataUrl}
              className="btn btn-whatsapp-share"
              style={{
                width: '100%',
                marginBottom: shareHint ? '0.5rem' : '0.85rem',
                borderRadius: '12px',
                padding: '0.75rem',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: sharing || !qrData.qrCodeDataUrl ? 0.6 : 1,
                cursor: sharing || !qrData.qrCodeDataUrl ? 'not-allowed' : 'pointer'
              }}
            >
              <MessageSquare size={18} />
              {sharing ? 'Preparing QR...' : 'Share QR on WhatsApp'}
            </button>
            {shareHint && (
              <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.55rem 0.65rem', borderRadius: '10px', fontSize: '0.78rem', marginBottom: '0.85rem', lineHeight: 1.45, border: '1px solid #a7f3d0', textAlign: 'left' }}>
                {shareHint}
              </div>
            )}

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.55rem', borderRadius: '10px', fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitPayment}
              disabled={submitting}
              className="btn btn-primary pulse-button"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.9rem', borderRadius: '14px' }}
            >
              {submitting ? 'Submitting...' : '✓ I Have Paid — Submit for Approval'}
            </button>
          </>
        ) : null}

      </div>
    </div>
  );
}
