import React, { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { generateUpiQrDataUrl } from '../../utils/upiQr';

export default function UpiQrDisplay({
  upiId,
  payeeName = 'Payment',
  amount,
  note = '',
  size = 200,
  className = ''
}) {
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!upiId?.trim()) {
        setQrUrl('');
        return;
      }
      setLoading(true);
      try {
        const url = await generateUpiQrDataUrl({ upiId, payeeName, amount, note });
        if (!cancelled) setQrUrl(url);
      } catch {
        if (!cancelled) setQrUrl('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [upiId, payeeName, amount, note]);

  if (!upiId?.trim()) {
    return (
      <div className={`upi-qr-placeholder ${className}`} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
        <QrCode size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.8rem' }}>Pehle UPI ID enter karein</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>QR generating...</div>;
  }

  if (!qrUrl) return null;

  return (
    <img
      src={qrUrl}
      alt="UPI QR Code"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block', margin: '0 auto', borderRadius: '12px' }}
    />
  );
}
