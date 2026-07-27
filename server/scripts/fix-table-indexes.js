/** Drop legacy table index. Usage: node scripts/fix-table-indexes.js */
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const connectDB = require('../config/db');
const { migrateTableIndexes } = require('../utils/tableIndexMigration');

async function main() {
  await connectDB();
  await migrateTableIndexes({ log: true });
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
