const MenuItem = require('../models/MenuItem');
const { ensureMenuItemImageStored, getMenuItemPhotoPath } = require('./menuImage');

/**
 * Move legacy /uploads/ paths into MongoDB imageData + stable /photo URL.
 * Safe to run on every server start and on menu list fetch.
 */
async function migrateMenuImages({ log = false } = {}) {
  const candidates = await MenuItem.find({
    $or: [
      { image: /^\/uploads\// },
      { image: /^data:/ },
      { imageData: { $exists: true, $ne: '' } },
      { image: { $regex: /\/menu-item\/.*\/photo$/ } }
    ]
  }).select('+imageData image updatedAt');

  let migrated = 0;

  for (const item of candidates) {
    const beforeImage = item.image;
    await ensureMenuItemImageStored(item);

    if (item.imageData && item.image !== getMenuItemPhotoPath(item._id)) {
      item.image = getMenuItemPhotoPath(item._id);
      await item.save();
      migrated += 1;
      continue;
    }

    if (beforeImage !== item.image && item.image?.includes('/photo')) {
      migrated += 1;
    }
  }

  if (log && migrated > 0) {
    console.log(`[menu-images] normalized ${migrated} menu item photo(s)`);
  }

  return migrated;
}

module.exports = { migrateMenuImages };
