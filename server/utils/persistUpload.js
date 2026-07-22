const fs = require('fs');
const path = require('path');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
};

/** Store upload in MongoDB as data URL so images survive Render redeploys */
function persistUploadedImage(file, maxBytes = 3 * 1024 * 1024) {
  if (!file?.path) return '';

  try {
    const buffer = fs.readFileSync(file.path);
    if (buffer.length > maxBytes) {
      throw new Error('Image must be 3MB or smaller');
    }

    const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
    const mime = file.mimetype?.startsWith('image/')
      ? file.mimetype
      : (MIME_BY_EXT[ext] || 'image/jpeg');

    return `data:${mime};base64,${buffer.toString('base64')}`;
  } finally {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = { persistUploadedImage };
