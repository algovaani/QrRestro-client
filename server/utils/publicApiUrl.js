/** Public base URL for API routes (bill PDF links, WhatsApp share links) */
function getPublicApiBase(req) {
  const fromEnv =
    process.env.PUBLIC_API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.API_PUBLIC_URL;
  if (fromEnv) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  if (req) {
    const requestBase = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
    const clientUrl = process.env.CLIENT_URL?.trim();
    if (clientUrl) {
      try {
        const clientOrigin = new URL(clientUrl).origin;
        const requestOrigin = new URL(requestBase).origin;
        if (clientOrigin === requestOrigin) {
          console.warn(
            '[bill-link] PUBLIC_API_URL is not set and request host matches CLIENT_URL — ' +
              'set PUBLIC_API_URL to your API server URL on Render (e.g. https://your-api.onrender.com).'
          );
        }
      } catch {
        /* ignore */
      }
    }
    return requestBase;
  }

  return '';
}

function orderBillIsAvailable(order) {
  return order.paymentStatus === 'Paid' || Boolean(order.paidAt);
}

function getPublicBillPdfUrl(orderNumber, req) {
  const base = getPublicApiBase(req);
  return `${base}/api/public/orders/${encodeURIComponent(orderNumber)}/bill.pdf`;
}

module.exports = { getPublicApiBase, getPublicBillPdfUrl, orderBillIsAvailable };
