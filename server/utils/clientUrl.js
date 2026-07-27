const os = require('os');

function pickLanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const lower = name.toLowerCase();
      if (/vether|vmware|virtualbox|hyper-v/i.test(lower)) continue;
      candidates.push({ name, address: net.address });
    }
  }
  const preferred = candidates.find((c) => !c.address.startsWith('192.168.137.'));
  return (preferred || candidates[0])?.address || null;
}

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
  if (process.env.NODE_ENV !== 'production') {
    const lanIp = process.env.DEV_LAN_IP?.trim() || pickLanIp();
    if (lanIp && /localhost|127\.0\.0\.1/.test(url)) {
      url = url.replace(/localhost|127\.0\.0\.1/, lanIp);
    }
  }
  return url;
}

/** CORS allowed origins — CLIENT_URL can be comma-separated */
function getAllowedOrigins() {
  return [...new Set(getUrlSources())];
}

module.exports = { getClientUrl, getAllowedOrigins };
