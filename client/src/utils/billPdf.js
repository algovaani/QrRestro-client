import { jsPDF } from 'jspdf';

const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

/**
 * Generate order bill as PDF blob (A5 receipt style)
 */
export function generateOrderBillPdfBlob(order, options = {}) {
  const restaurantName = options.restaurantName || 'Royal Spice Restaurant';
  const taxLabel = options.taxLabel || 'GST Tax';

  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = 14;

  const ensureSpace = (need = 8) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + need > pageH - 12) {
      doc.addPage();
      y = 14;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(restaurantName.toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(11);
  doc.text('TAX INVOICE / RECEIPT', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const metaRows = [
    ['Order #', order.orderNumber || '—'],
    ['Table #', `Table ${order.tableNumber ?? '—'}`],
    ['Date', formatDate(order.createdAt || Date.now())],
    ['Customer', order.customerName || 'Guest'],
    ['Mobile', order.customerMobile || 'N/A']
  ];

  metaRows.forEach(([label, value]) => {
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 28, y);
    y += 5;
  });

  y += 2;
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Item', margin, y);
  doc.text('Qty', margin + contentW * 0.62, y, { align: 'center' });
  doc.text('Amount', pageW - margin, y, { align: 'right' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  (order.items || []).forEach((item) => {
    ensureSpace(12);
    const title = `${item.itemName || 'Item'} (${item.size || 'Full'})`;
    const wrapped = doc.splitTextToSize(title, contentW * 0.58);
    doc.text(wrapped, margin, y);
    doc.text(String(item.quantity ?? 1), margin + contentW * 0.62, y, { align: 'center' });
    doc.text(`₹${item.total ?? 0}`, pageW - margin, y, { align: 'right' });
    y += wrapped.length * 4.5;

    if (item.instructions) {
      ensureSpace(6);
      doc.setFontSize(8);
      doc.setTextColor(100);
      const note = doc.splitTextToSize(`Note: ${item.instructions}`, contentW);
      doc.text(note, margin + 2, y);
      y += note.length * 3.8;
      doc.setTextColor(0);
      doc.setFontSize(9);
    }
    y += 1;
  });

  y += 2;
  ensureSpace(28);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const totalRow = (label, value, bold = false) => {
    ensureSpace(6);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, margin, y);
    doc.text(String(value), pageW - margin, y, { align: 'right' });
    y += bold ? 7 : 5;
  };

  totalRow('Subtotal:', `₹${order.subtotal ?? 0}`);
  totalRow(`${taxLabel}:`, `₹${order.tax ?? 0}`);
  totalRow('GRAND TOTAL:', `₹${order.grandTotal ?? 0}`, true);

  doc.line(margin, y, pageW - margin, y);
  y += 6;

  totalRow('Payment:', `${order.paymentStatus || 'Unpaid'} (${order.paymentMethod || 'UPI'})`);
  totalRow('TXN ID:', order.transactionId || 'N/A');

  y += 4;
  ensureSpace(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Thank you for dining with us!', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Computer generated bill — no signature required', pageW / 2, y, { align: 'center' });

  return doc.output('blob');
}

export function buildBillWhatsAppMessage(order, restaurantName) {
  return [
    `🧾 *${restaurantName || 'Restaurant'} — Bill*`,
    `Order #: *${order.orderNumber}*`,
    `Table #: *${order.tableNumber}*`,
    `Amount: *₹${order.grandTotal}*`,
    `Payment: *${order.paymentStatus}*`,
    '',
    'PDF bill attached — please check 📄'
  ].join('\n');
}
