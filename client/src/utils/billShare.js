import { generateOrderBillPdfBlob, buildBillWhatsAppMessage } from './billPdf';
import { isMobileDevice, openWhatsApp, openWhatsAppMobile } from './shareWhatsApp';

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

async function trySharePdf(file, message) {
  if (!navigator.share) return null;

  const payloads = [
    { files: [file], text: message, title: `Bill ${file.name}` },
    { files: [file], text: message },
    { files: [file] }
  ];

  for (const payload of payloads) {
    try {
      if (navigator.canShare && !navigator.canShare(payload)) continue;
      await navigator.share(payload);
      return 'share';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  return null;
}

/**
 * Admin / customer — generate PDF bill and share on WhatsApp
 */
export async function sendOrderBillOnWhatsApp(order, options = {}) {
  if (!order?.orderNumber) {
    throw new Error('Invalid order');
  }

  const restaurantName = options.restaurantName || 'Royal Spice Restaurant';
  const phone = order.customerMobile ? String(order.customerMobile).replace(/\D/g, '').slice(-10) : '';
  const message = buildBillWhatsAppMessage(order, restaurantName);
  const filename = `Bill-${order.orderNumber}.pdf`;

  const blob = generateOrderBillPdfBlob(order, {
    restaurantName,
    taxLabel: options.taxLabel || 'GST Tax'
  });
  const file = new File([blob], filename, { type: 'application/pdf' });

  const shared = await trySharePdf(file, message);
  if (shared === 'share') {
    return { success: true, method: 'share' };
  }
  if (shared === 'cancelled') {
    return { success: false, cancelled: true };
  }

  downloadBlob(blob, filename);

  if (phone) {
    if (isMobileDevice()) {
      openWhatsAppMobile(phone, message);
    } else {
      openWhatsApp(phone, message);
    }
  } else {
    openWhatsApp(null, message);
  }

  return { success: true, method: 'download' };
}
