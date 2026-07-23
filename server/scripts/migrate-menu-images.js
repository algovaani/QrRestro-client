/**
 * One-time / manual migration: store menu photos in MongoDB (survives Render redeploy).
 * Run: node server/scripts/migrate-menu-images.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const connectDB = require('../config/db');
const { migrateMenuImages } = require('../utils/migrateMenuImages');

(async () => {
  await connectDB();
  const count = await migrateMenuImages({ log: true });
  console.log(`Done. Normalized ${count} item(s). Items with only /uploads/ and no file left need re-upload.`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
