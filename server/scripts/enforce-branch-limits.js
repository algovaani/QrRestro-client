/**
 * Manually enforce branch limits for all restaurant admins.
 * Usage: node scripts/enforce-branch-limits.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { enforceBranchLimitsForAllAdmins } = require('../utils/branchLimits');

const run = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const result = await enforceBranchLimitsForAllAdmins({ log: true });
  console.log('Done:', result);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
