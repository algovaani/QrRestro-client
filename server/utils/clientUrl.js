/** Primary public URL for QR links (first entry if comma-separated) */
function getClientUrl() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

/** CORS allowed origins — CLIENT_URL can be comma-separated */
function getAllowedOrigins() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

module.exports = { getClientUrl, getAllowedOrigins };
