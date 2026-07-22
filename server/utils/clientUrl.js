function getUrlSources() {
  const parts = [];
  if (process.env.CLIENT_URL) {
    parts.push(...process.env.CLIENT_URL.split(','));
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    parts.push(process.env.RENDER_EXTERNAL_URL);
  }
  if (!parts.length) {
    parts.push('http://localhost:5173');
  }
  return parts.map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

/** Primary public URL for QR links (first entry if comma-separated) */
function getClientUrl() {
  let url = getUrlSources()[0];
  // Dev: customer UI runs on Vite (:5173), not the API server (:5000)
  if (process.env.NODE_ENV !== 'production' && /:5000(\/|$)/.test(url)) {
    url = url.replace(':5000', ':5173');
  }
  return url;
}

/** CORS allowed origins — CLIENT_URL can be comma-separated */
function getAllowedOrigins() {
  return [...new Set(getUrlSources())];
}

module.exports = { getClientUrl, getAllowedOrigins };
