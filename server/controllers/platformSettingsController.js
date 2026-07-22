const PlatformSettings = require('../models/PlatformSettings');

const normalizeSupportNumber = (value) => String(value || '').replace(/\D/g, '').slice(-10);

async function getOrCreatePlatformSettings() {
  let settings = await PlatformSettings.findOne({ key: 'global' });
  if (!settings) {
    settings = await PlatformSettings.create({ key: 'global', supportNumber: '' });
  }
  return settings;
}

// @desc Get platform settings (Super Admin)
// @route GET /api/super-admin/platform-settings
exports.getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreatePlatformSettings();
    res.json({
      success: true,
      settings: {
        supportNumber: settings.supportNumber || ''
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update platform settings (Super Admin)
// @route PUT /api/super-admin/platform-settings
exports.updatePlatformSettings = async (req, res, next) => {
  try {
    const { supportNumber } = req.body || {};
    const cleaned = normalizeSupportNumber(supportNumber);

    if (supportNumber && cleaned.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit support mobile number.'
      });
    }

    const settings = await getOrCreatePlatformSettings();
    settings.supportNumber = cleaned;
    await settings.save();

    res.json({
      success: true,
      message: 'Platform settings saved successfully.',
      settings: {
        supportNumber: settings.supportNumber
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Support number for admin membership page
// @route GET /api/auth/platform-settings
exports.getPublicPlatformSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreatePlatformSettings();
    res.json({
      success: true,
      supportNumber: settings.supportNumber || ''
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getOrCreatePlatformSettings = getOrCreatePlatformSettings;
