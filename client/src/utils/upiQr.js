import QRCode from 'qrcode';

export const buildUpiPayString = ({ upiId, payeeName = 'Payment', amount, note = '' }) => {
  if (!upiId?.trim()) return '';
  const cleanName = String(payeeName).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Payment';
  let str = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(cleanName)}&cu=INR`;
  if (amount !== undefined && amount !== null && amount !== '') {
    str += `&am=${amount}`;
  }
  if (note) str += `&tn=${encodeURIComponent(String(note))}`;
  return str;
};

export async function generateUpiQrDataUrl({ upiId, payeeName, amount, note }) {
  const upiString = buildUpiPayString({ upiId, payeeName, amount, note });
  if (!upiString) return '';
  return QRCode.toDataURL(upiString, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 280,
    color: { dark: '#1e293b', light: '#ffffff' }
  });
}
