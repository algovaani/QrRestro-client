const PlanFeature = require('../models/PlanFeature');
const MembershipPlan = require('../models/MembershipPlan');
const Branch = require('../models/Branch');
const {
  normalizeFeatureKeys,
  getFeatureCatalog
} = require('../utils/planFeatures');

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

exports.getAllPlanFeatures = async (req, res, next) => {
  try {
    const catalog = await getFeatureCatalog();
    res.json({ success: true, count: catalog.length, features: catalog });
  } catch (error) {
    next(error);
  }
};

exports.createPlanFeature = async (req, res, next) => {
  try {
    const label = String(req.body.label || '').trim();
    const key = normalizeKey(req.body.key || label);

    if (!label || !key) {
      return res.status(400).json({ success: false, message: 'Feature label and key are required.' });
    }

    const exists = await PlanFeature.findOne({ key });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A feature with this key already exists.' });
    }

    const feature = await PlanFeature.create({
      key,
      label,
      group: String(req.body.group || 'General').trim(),
      menuKey: String(req.body.menuKey || 'general').trim().toLowerCase(),
      description: String(req.body.description || '').trim(),
      status: req.body.status === 'Inactive' ? 'Inactive' : 'Active',
      assignableToBranch: req.body.assignableToBranch !== false,
      sortOrder: Number(req.body.sortOrder) || 0
    });

    res.status(201).json({ success: true, message: 'Feature created successfully', feature });
  } catch (error) {
    next(error);
  }
};

exports.updatePlanFeature = async (req, res, next) => {
  try {
    const feature = await PlanFeature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    const previousKey = feature.key;
    const nextLabel = req.body.label !== undefined ? String(req.body.label || '').trim() : feature.label;
    const nextKey = req.body.key !== undefined ? normalizeKey(req.body.key) : feature.key;

    if (!nextLabel || !nextKey) {
      return res.status(400).json({ success: false, message: 'Feature label and key are required.' });
    }

    const duplicate = await PlanFeature.findOne({ key: nextKey, _id: { $ne: feature._id } });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'A feature with this key already exists.' });
    }

    feature.label = nextLabel;
    feature.key = nextKey;
    if (req.body.group !== undefined) feature.group = String(req.body.group || 'General').trim();
    if (req.body.menuKey !== undefined) feature.menuKey = String(req.body.menuKey || 'general').trim().toLowerCase();
    if (req.body.description !== undefined) feature.description = String(req.body.description || '').trim();
    if (req.body.status !== undefined) feature.status = req.body.status === 'Inactive' ? 'Inactive' : 'Active';
    if (req.body.assignableToBranch !== undefined) feature.assignableToBranch = Boolean(req.body.assignableToBranch);
    if (req.body.sortOrder !== undefined && req.body.sortOrder !== '') feature.sortOrder = Number(req.body.sortOrder) || 0;
    await feature.save();

    if (previousKey !== nextKey) {
      await Promise.all([
        MembershipPlan.updateMany({ featureKeys: previousKey }, { $set: { 'featureKeys.$[feature]': nextKey } }, { arrayFilters: [{ feature: previousKey }] }),
        Branch.updateMany({ featureKeys: previousKey }, { $set: { 'featureKeys.$[feature]': nextKey } }, { arrayFilters: [{ feature: previousKey }] })
      ]);
    }

    if (feature.status === 'Inactive') {
      await Promise.all([
        MembershipPlan.updateMany({}, { $pull: { featureKeys: feature.key } }),
        Branch.updateMany({}, { $pull: { featureKeys: feature.key } })
      ]);
    }

    res.json({ success: true, message: 'Feature updated successfully', feature });
  } catch (error) {
    next(error);
  }
};

exports.deletePlanFeature = async (req, res, next) => {
  try {
    const feature = await PlanFeature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    await Promise.all([
      MembershipPlan.updateMany({}, { $pull: { featureKeys: feature.key } }),
      Branch.updateMany({}, { $pull: { featureKeys: feature.key } }),
      feature.deleteOne()
    ]);

    res.json({ success: true, message: 'Feature deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateBranchFeatures = async (req, res, next) => {
  try {
    const branch = req.branchRecord;
    const allowedKeys = await normalizeFeatureKeys(req.allowedPlanFeatureKeys || []);
    const requestedKeys = await normalizeFeatureKeys(req.body.featureKeys || []);
    const allowedSet = new Set(allowedKeys);
    branch.featureKeys = requestedKeys.filter((key) => allowedSet.has(key));
    await branch.save();
    res.json({ success: true, message: 'Branch features updated successfully', branch });
  } catch (error) {
    next(error);
  }
};
