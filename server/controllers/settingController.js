const Setting = require('../models/Setting');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');
const { generateQRCode } = require('../utils/qrGenerator');
const { buildUpiPayString } = require('../utils/upiHelper');

const resolveTenantAdminId = (req) => {
  const adminId = getTenantAdminId(req.user);
  if (!adminId) {
    const error = new Error('Only restaurant admins can manage settings');
    error.status = 403;
    throw error;
  }
  return adminId;
};

// @desc Get Restaurant Settings (filtered by adminId)
// @route GET /api/settings
exports.getSettings = async (req, res, next) => {
  try {
    const adminId = resolveTenantAdminId(req);
    let setting = await Setting.findOne({ adminId });
    if (!setting) {
      setting = await Setting.create({
        adminId,
        restaurantName: req.user.restaurantName || 'Royal Spice Restaurant',
        upiId: 'restaurant@upi'
      });
    }

    let qrCodeDataUrl = '';
    if (setting.upiId) {
      const upiString = buildUpiPayString({
        upiId: setting.upiId,
        payeeName: setting.restaurantName || 'Restaurant',
        amount: 1,
        note: 'Preview'
      });
      qrCodeDataUrl = await generateQRCode(upiString);
    }

    res.json({
      success: true,
      setting: {
        ...setting.toObject(),
        upiQrCode: undefined,
        qrCodeDataUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update Restaurant Settings
// @route PUT /api/settings
exports.updateSettings = async (req, res, next) => {
  try {
    const adminId = resolveTenantAdminId(req);
    let setting = await Setting.findOne({ adminId });

    if (!setting) {
      setting = new Setting({ adminId });
    }

    const fields = [
      'restaurantName', 'upiId', 'address', 'mobile',
      'gstNumber', 'taxPercentage', 'currency',
      'openingTime', 'closingTime', 'themeColor', 'soundNotification'
    ];

    fields.forEach(field => {
      if (req.body[field] === undefined) return;
      if (field === 'taxPercentage') {
        setting.taxPercentage = Math.min(100, Math.max(0, Number(req.body.taxPercentage) || 0));
        return;
      }
      if (field === 'soundNotification') {
        setting.soundNotification = req.body.soundNotification === 'true' || req.body.soundNotification === true;
        return;
      }
      setting[field] = req.body[field];
    });

    if (req.files?.logo?.[0]) {
      setting.logo = `/uploads/${req.files.logo[0].filename}`;
    }

    await setting.save();

    let qrCodeDataUrl = '';
    if (setting.upiId) {
      const upiString = buildUpiPayString({
        upiId: setting.upiId,
        payeeName: setting.restaurantName || 'Restaurant',
        amount: 1,
        note: 'Preview'
      });
      qrCodeDataUrl = await generateQRCode(upiString);
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      setting: {
        ...setting.toObject(),
        upiQrCode: undefined,
        qrCodeDataUrl
      }
    });
  } catch (error) {
    next(error);
  }
};
