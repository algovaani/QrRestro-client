/** Regenerate all table QR codes after CLIENT_URL change. Usage: node scripts/regenerate-all-qr.js */
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const Table = require('../models/Table');
const { getClientUrl } = require('../utils/clientUrl');
const { buildMenuQrUrl } = require('../utils/tenantUtils');

async function main() {
  const clientUrl = getClientUrl();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_qr');
  const tables = await Table.find({});
  let count = 0;
  for (const table of tables) {
    const qrUrl = buildMenuQrUrl(clientUrl, table.adminId, table.tableNumber);
    table.qrUrl = qrUrl;
    table.qrCodeImage = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: 'H', margin: 2, width: 300 });
    await table.save();
    count++;
    console.log(`Updated Table ${table.tableNumber}: ${qrUrl}`);
  }
  console.log(`\nDone — ${count} table QR(s) regenerated for ${clientUrl}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
