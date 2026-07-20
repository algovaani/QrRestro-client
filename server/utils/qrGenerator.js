const QRCode = require('qrcode');

const QR_OPTIONS = {
  errorCorrectionLevel: 'H',
  type: 'image/png',
  margin: 2,
  width: 400,
  color: {
    dark: '#1e293b',
    light: '#ffffff'
  }
};

const generateQRCode = async (qrUrl) => {
  try {
    return await QRCode.toDataURL(qrUrl, QR_OPTIONS);
  } catch (err) {
    console.error('Error generating QR Code:', err);
    throw err;
  }
};

const generateQRCodeBuffer = async (qrUrl) => {
  try {
    return await QRCode.toBuffer(qrUrl, QR_OPTIONS);
  } catch (err) {
    console.error('Error generating QR Code buffer:', err);
    throw err;
  }
};

module.exports = { generateQRCode, generateQRCodeBuffer };
