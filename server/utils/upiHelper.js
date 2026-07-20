/** Build UPI deep-link string for QR generation */
const buildUpiPayString = ({ upiId, payeeName = 'Payment', amount, note = '' }) => {
  if (!upiId?.trim()) return '';
  const cleanName = String(payeeName).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Payment';
  let str = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(cleanName)}&cu=INR`;
  if (amount !== undefined && amount !== null && amount !== '') {
    str += `&am=${amount}`;
  }
  if (note) str += `&tn=${encodeURIComponent(String(note))}`;
  return str;
};

module.exports = { buildUpiPayString };
