const PDFDocument = require('pdfkit');

const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
};

const formatMoneyForPdf = (value) => `Rs. ${formatMoney(value)}`;

/**
 * Generate order bill PDF buffer (A5 receipt style)
 */
function generateOrderBillPdfBuffer(order, options = {}) {
  const restaurantName = options.restaurantName || 'Royal Spice Restaurant';
  const taxLabel = options.taxLabel || 'GST Tax';
  const contactNumber = options.contactNumber || '';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 36 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(15).font('Helvetica-Bold').text(restaurantName.toUpperCase(), { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(11).text('TAX INVOICE / RECEIPT', { align: 'center' });
    doc.moveDown(0.4);

    const lineY = doc.y;
    doc.moveTo(36, lineY).lineTo(doc.page.width - 36, lineY).stroke();
    doc.moveDown(0.4);

    doc.fontSize(9).font('Helvetica');
    const meta = [
      ['Order #', order.orderNumber || '—'],
      ['Table #', `Table ${order.tableNumber ?? '—'}`],
      ['Date', formatDate(order.createdAt || Date.now())],
      ['Customer', order.customerName || 'Guest'],
      ['Mobile', order.customerMobile || 'N/A']
    ];

    meta.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(String(value));
    });

    doc.moveDown(0.3);
    const itemsLineY = doc.y;
    doc.moveTo(36, itemsLineY).lineTo(doc.page.width - 36, itemsLineY).stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').text('ORDERED ITEMS');
    doc.moveDown(0.25);
    doc.font('Helvetica');

    (order.items || []).forEach((item) => {
      const qty = item.quantity ?? 1;
      const lineTotal = item.total ?? Number(item.price) * qty;
      const title = `${item.itemName || 'Item'} (${item.size || 'Full'}) x${qty}`;
      doc.text(`${title} — ${formatMoneyForPdf(lineTotal)}`);
      if (item.instructions) {
        doc.fontSize(8).fillColor('#666666').text(`  Note: ${item.instructions}`);
        doc.fontSize(9).fillColor('#000000');
      }
    });

    doc.moveDown(0.3);
    const totalLineY = doc.y;
    doc.moveTo(36, totalLineY).lineTo(doc.page.width - 36, totalLineY).stroke();
    doc.moveDown(0.4);

    doc.text(`Subtotal: ${formatMoneyForPdf(order.subtotal)}`, { align: 'right' });
    doc.text(`${taxLabel}: ${formatMoneyForPdf(order.tax)}`, { align: 'right' });
    doc.font('Helvetica-Bold').text(`GRAND TOTAL: ${formatMoneyForPdf(order.grandTotal)}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text(`Payment: ${order.paymentStatus || 'Unpaid'} (${order.paymentMethod || 'UPI'})`, { align: 'right' });
    doc.text(`TXN ID: ${order.transactionId || 'N/A'}`, { align: 'right' });

    doc.moveDown(0.8);
    if (contactNumber) {
      doc.font('Helvetica').fontSize(9).fillColor('#333333')
        .text(`Restaurant Contact: ${contactNumber}`, { align: 'center' });
      doc.moveDown(0.4);
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Thank you for dining with us!', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateOrderBillPdfBuffer };
