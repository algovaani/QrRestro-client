import API from '../services/api';
import { generateOrderBillPdfBlob, buildBillWhatsAppMessage } from './billPdf';
import { getPublicApiOrigin } from './publicApiOrigin';
import { normalizeIndianPhone, openWhatsApp } from './shareWhatsApp';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Public bill PDF link — must target the API server, not the static client host */
export function getPublicBillPdfUrl(orderNumber) {
  const base = getPublicApiOrigin();
  return `${base}/api/public/orders/${encodeURIComponent(orderNumber)}/bill.pdf`;
}

async function resolveBillPdfUrl(orderNumber) {
  try {
    const { data } = await API.get(`/public/orders/${encodeURIComponent(orderNumber)}/bill-link`);
    if (data?.success && data?.billUrl) {
      return data.billUrl;
    }
  } catch {
    /* fall back to env-based URL */
  }
  return getPublicBillPdfUrl(orderNumber);
}

/**
 * Admin / customer — open WhatsApp for order customer with bill PDF link (no file download)
 */
export async function sendOrderBillOnWhatsApp(order, options = {}) {
  if (!order?.orderNumber) {
    throw new Error('Invalid order');
  }

  const phone = normalizeIndianPhone(order.customerMobile);
  if (!phone) {
    throw new Error('Customer mobile number is missing — cannot send bill on WhatsApp.');
  }

  const restaurantName = options.restaurantName || 'Royal Spice Restaurant';
  const billUrl = await resolveBillPdfUrl(order.orderNumber);
  const message = buildBillWhatsAppMessage(order, restaurantName, billUrl);

  openWhatsApp(phone, message);

  return {
    success: true,
    method: 'whatsapp-link',
    phone,
    billUrl,
    hint: `WhatsApp opened for +91 ${phone}. Tap Send — customer will get the bill link directly.`
  };
}

/**
 * Download bill PDF to this device (no WhatsApp)
 */
export async function downloadOrderBillPdf(order, options = {}) {
  const filename = `Bill-${order.orderNumber}.pdf`;
  const blob = await generateOrderBillPdfBlob(order, options);
  downloadBlob(blob, filename);
  return { success: true, filename };
}
