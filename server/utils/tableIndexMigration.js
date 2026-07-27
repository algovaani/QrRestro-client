const Table = require('../models/Table');

/**
 * Drop legacy unique index { adminId, tableNumber } so each branch can reuse table numbers.
 * Ensures current index { adminId, branchId, tableNumber } is in place.
 */
async function migrateTableIndexes({ log = false } = {}) {
  const collection = Table.collection;
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    const keys = idx.key || {};
    const isLegacyUnique =
      keys.adminId === 1 &&
      keys.tableNumber === 1 &&
      keys.branchId === undefined &&
      idx.unique;

    if (isLegacyUnique) {
      await collection.dropIndex(idx.name);
      if (log) {
        console.log(`[tables] dropped legacy index: ${idx.name}`);
      }
    }
  }

  await Table.syncIndexes();
  if (log) {
    const after = await collection.indexes();
    const names = after.map((i) => i.name).join(', ');
    console.log(`[tables] indexes synced — ${names}`);
  }
}

module.exports = { migrateTableIndexes };
