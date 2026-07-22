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
    const apiOrigin = getApiOrigin()?.replace(/\/$/, '');
    const clientOrigin = window.location.origin;

    if (!parsed.pathname.includes('/api/public/orders/')) {
      return fallback;
    }

    // Split deploy: never share bill links on the static client host
    if (apiOrigin && parsed.origin === clientOrigin && apiOrigin !== clientOrigin) {
      return fallback;
    }

    if (apiOrigin && parsed.origin !== apiOrigin) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    }

    return parsed.href;
  } catch {
    return fallback;
  }
}

async function resolveBillContext(orderNumber, options = {}) {
  let billUrl = getPublicBillPdfUrl(orderNumber);
  let contactNumber = options.contactNumber || '';
  let address = options.address || '';
  let gstNumber = options.gstNumber || '';
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
      if (data.address) {
        address = data.address;
      }
      if (data.gstNumber) {
        gstNumber = data.gstNumber;
      }
      if (data.restaurantName && !restaurantName) {
        restaurantName = data.restaurantName;
      }
    }
  } catch {
    /* fall back to detected API origin */
  }

  return { billUrl, contactNumber, address, gstNumber, restaurantName };
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
  const { billUrl, contactNumber, address, gstNumber, restaurantName: resolvedName } = await resolveBillContext(
    order.orderNumber,
    options
  );
  const finalRestaurantName = restaurantName || resolvedName || 'Royal Spice Restaurant';
  const restaurantInfo = {
    contactNumber: options.contactNumber || contactNumber || '',
    address: options.address || address || '',
    gstNumber: options.gstNumber || gstNumber || ''
  };
  const message = buildBillWhatsAppMessage(order, finalRestaurantName, billUrl, restaurantInfo);

  openWhatsApp(phone, message);

  return {
    success: true,
    method: 'whatsapp-link',
    phone,
    billUrl,
    ...restaurantInfo,
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
