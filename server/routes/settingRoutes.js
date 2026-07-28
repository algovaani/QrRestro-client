const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { requirePlanFeature } = require('../middleware/planFeatureMiddleware');

router.get('/', protect, requirePlanFeature('settings'), getSettings);

const handleUpload = (req, res, next) => {
  upload.fields([
    { name: 'logo', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
    }
    next();
  });
};

router.put('/', protect, requirePlanFeature('settings'), handleUpload, updateSettings);
router.post('/save', protect, requirePlanFeature('settings'), handleUpload, updateSettings);

module.exports = router;
