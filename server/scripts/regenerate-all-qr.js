/** Regenerate all table QR codes after CLIENT_URL change. Usage: node scripts/regenerate-all-qr.js */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const { getClientUrl } = require('../utils/clientUrl');
const { migrateTableQrUrls } = require('../utils/tableQrUtils');

async function main() {
  const clientUrl = getClientUrl();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_qr');
  const count = await migrateTableQrUrls({ log: true });
  console.log(`\nDone — ${count} table QR(s) regenerated for ${clientUrl}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
