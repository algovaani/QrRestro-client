/** Public base URL for API routes (bill PDF links, etc.) */
function getPublicApiBase(req) {
  const fromEnv = process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL;
  if (fromEnv) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  if (req) {
    return `${req.protocol}://${req.get('host')}`;
  }
  return '';
}

function getPublicBillPdfUrl(orderNumber, req) {
  const base = getPublicApiBase(req);
  return `${base}/api/public/orders/${encodeURIComponent(orderNumber)}/bill.pdf`;
}

module.exports = { getPublicApiBase, getPublicBillPdfUrl };
