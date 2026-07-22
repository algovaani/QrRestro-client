import API, { getApiOrigin } from '../services/api';
import { generateOrderBillPdfBlob, buildBillWhatsAppMessage } from './billPdf';
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
  const base = getApiOrigin();
  return `${base}/api/public/orders/${encodeURIComponent(orderNumber)}/bill.pdf`;
}

function normalizeBillPdfUrl(url, orderNumber) {
  const fallback = getPublicBillPdfUrl(orderNumber);
  if (!url) return fallback;

  try {
    const parsed = new URL(url);
    const apiOrigin = getApiOrigin();
    if (apiOrigin !== window.location.origin && parsed.origin === window.location.origin) {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
}

async function resolveBillContext(orderNumber, options = {}) {
  let billUrl = getPublicBillPdfUrl(orderNumber);
  let contactNumber = options.contactNumber || '';
  let restaurantName = options.restaurantName || '';

  try {
    const { data } = await API.get(`/public/orders/${encodeURIComponent(orderNumber)}/bill-link`);
    if (data?.success) {
      if (data.billUrl) {
        billUrl = normalizeBillPdfUrl(data.billUrl, orderNumber);
      }
      if (data.contactNumber) {
        contactNumber = data.contactNumber;
      }
      if (data.restaurantName && !restaurantName) {
        restaurantName = data.restaurantName;
      }
    }
  } catch {
    /* fall back to detected API origin */
  }

  return { billUrl, contactNumber, restaurantName };
}

/**
 * Admin — open WhatsApp chat with customer (admin taps Send)
 * Customer — open own WhatsApp to share bill link
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
  const { billUrl, contactNumber, restaurantName: resolvedName } = await resolveBillContext(
    order.orderNumber,
    options
  );
  const finalRestaurantName = restaurantName || resolvedName || 'Royal Spice Restaurant';
  const finalContact = options.contactNumber || contactNumber || '';
  const message = buildBillWhatsAppMessage(order, finalRestaurantName, billUrl, finalContact);

  openWhatsApp(phone, message);

  return {
    success: true,
    method: 'whatsapp-link',
    phone,
    billUrl,
    contactNumber: finalContact,
    hint: options.forAdmin
      ? null
      : 'WhatsApp khul gaya hai. Send dabayein — aapko bill link milega.'
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
