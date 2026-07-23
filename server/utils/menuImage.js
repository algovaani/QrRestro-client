const { persistUploadedImage } = require('./persistUpload');

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

function getMenuItemPhotoPath(id) {
  return `/api/public/menu-item/${id}/photo`;
}

function tryMigrateLegacyFileToDataUrl(imagePath) {
  if (!imagePath?.startsWith('/uploads/')) return '';
  const fs = require('fs');
  const path = require('path');
  const filename = path.basename(imagePath);
  const filePath = path.join(__dirname, '../uploads', filename);
  if (!fs.existsSync(filePath)) return '';

  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length > 3 * 1024 * 1024) return '';
    const ext = path.extname(filename).toLowerCase();
    const MIME_BY_EXT = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    const mime = MIME_BY_EXT[ext] || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

async function ensureMenuItemImageStored(item) {
  if (!item?._id) return item;
  if (item.imageData) return item;

  let dataUrl = '';
  if (item.image?.startsWith('data:')) {
    dataUrl = item.image;
  } else {
    dataUrl = tryMigrateLegacyFileToDataUrl(item.image);
  }

  if (!dataUrl) return item;

  item.imageData = dataUrl;
  item.image = getMenuItemPhotoPath(item._id);
  await item.save();
  return item;
}

function normalizeMenuItemImage(item) {
  const obj = item?.toObject ? item.toObject() : { ...item };
  if (!obj?._id) return obj;

  if (obj.image?.startsWith('data:')) {
    obj.image = getMenuItemPhotoPath(obj._id);
  } else if (obj.imageData && (!obj.image || obj.image.startsWith('/uploads/'))) {
    obj.image = getMenuItemPhotoPath(obj._id);
  }

  delete obj.imageData;
  return obj;
}

function readUploadedImageData(file) {
  return persistUploadedImage(file);
}

module.exports = {
  parseDataUrl,
  getMenuItemPhotoPath,
  normalizeMenuItemImage,
  readUploadedImageData,
  ensureMenuItemImageStored,
  tryMigrateLegacyFileToDataUrl
};
