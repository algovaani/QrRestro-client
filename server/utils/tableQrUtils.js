const Table = require('../models/Table');
const QRCode = require('qrcode');
const { getClientUrl } = require('./clientUrl');
const { buildMenuQrUrl } = require('./tenantUtils');

const QR_OPTIONS = { errorCorrectionLevel: 'H', margin: 2, width: 300 };

function buildExpectedQrUrl(table, clientUrl = getClientUrl()) {
  return buildMenuQrUrl(clientUrl, table.adminId, table.branchId, table.tableNumber);
}

function isStaleTableQr(table, clientUrl = getClientUrl()) {
  if (!table.branchId || !table.qrUrl || !table.qrCodeImage) return true;

  const expected = buildExpectedQrUrl(table, clientUrl);
  if (table.qrUrl === expected) return false;

  try {
    const expectedOrigin = new URL(clientUrl).origin;
    const currentOrigin = new URL(table.qrUrl).origin;
    if (currentOrigin !== expectedOrigin) return true;
  } catch {
    return true;
  }

  if (!table.qrUrl.includes('/branch/')) return true;
  return table.qrUrl !== expected;
}

async function generateQrAssets(table, clientUrl = getClientUrl()) {
  const qrUrl = buildExpectedQrUrl(table, clientUrl);
  const qrCodeImage = await QRCode.toDataURL(qrUrl, QR_OPTIONS);
  return { qrDataUrl: qrUrl, qrCodeImage };
}

async function refreshTableQr(table, clientUrl = getClientUrl()) {
  const qrUrl = buildExpectedQrUrl(table, clientUrl);
  table.qrUrl = qrUrl;
  table.qrCodeImage = await QRCode.toDataURL(qrUrl, QR_OPTIONS);
  await table.save();
  return qrUrl;
}

async function migrateTableQrUrls({ log = false } = {}) {
  const clientUrl = getClientUrl();
  const tables = await Table.find({});
  let updated = 0;

  for (const table of tables) {
    if (!table.branchId || !isStaleTableQr(table, clientUrl)) continue;
    const qrUrl = await refreshTableQr(table, clientUrl);
    updated += 1;
    if (log) {
      console.log(`[table-qr] updated Table ${table.tableNumber}: ${qrUrl}`);
    }
  }

  if (log && updated > 0) {
    console.log(`[table-qr] migration done — ${updated} table QR(s) updated for ${clientUrl}`);
  }

  return updated;
}

module.exports = {
  buildExpectedQrUrl,
  isStaleTableQr,
  generateQrAssets,
  refreshTableQr,
  migrateTableQrUrls
};
