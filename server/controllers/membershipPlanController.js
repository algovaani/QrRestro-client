const MembershipPlan = require('../models/MembershipPlan');
const { generateQRCode } = require('../utils/qrGenerator');
const { buildUpiPayString } = require('../utils/upiHelper');

const parseFeatures = (features) => {
  if (Array.isArray(features)) return features;
  if (typeof features === 'string') {
    return features.split(',').map((f) => f.trim()).filter(Boolean);
  }
  return [];
};

const applyPlanFields = (plan, body) => {
  const { name, price, durationDays, description, features, status, upiId } = body;

  if (name) plan.name = name.trim();
  if (price !== undefined && price !== '') plan.price = Number(price);
  if (durationDays) plan.durationDays = Number(durationDays);
  if (description !== undefined) plan.description = description;
  if (status) plan.status = status;
  if (upiId !== undefined) plan.upiId = String(upiId).trim();

  if (features !== undefined) {
    const parsed = parseFeatures(features);
    if (parsed.length > 0) plan.features = parsed;
  }
};

// @desc Get all Membership Plans
// @route GET /api/super-admin/plans
exports.getAllPlans = async (req, res, next) => {
  try {
    const plans = await MembershipPlan.find().sort({ price: 1 });
    res.json({
      success: true,
      count: plans.length,
      plans
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create New Membership Plan
// @route POST /api/super-admin/plans
exports.createPlan = async (req, res, next) => {
  try {
    const { name, price, durationDays } = req.body;

    if (!name || price === undefined || price === '' || !durationDays) {
      return res.status(400).json({ success: false, message: 'Plan Name, Price, and Duration in Days are required.' });
    }

    const existingPlan = await MembershipPlan.findOne({ name: name.trim() });
    if (existingPlan) {
      return res.status(400).json({ success: false, message: 'A plan with this name already exists.' });
    }

    const processedFeatures = parseFeatures(req.body.features);

    const plan = new MembershipPlan({
      name: name.trim(),
      price: Number(price),
      durationDays: Number(durationDays),
      description: req.body.description || '',
      features: processedFeatures.length > 0 ? processedFeatures : ['Unlimited Orders', 'Dynamic UPI QR', 'WhatsApp Bill'],
      status: req.body.status || 'Active',
      upiId: req.body.upiId ? String(req.body.upiId).trim() : ''
    });

    applyPlanFields(plan, req.body);
    await plan.save();

    res.status(201).json({
      success: true,
      message: 'Membership Plan created successfully',
      plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update Membership Plan
// @route PUT /api/super-admin/plans/:id
exports.updatePlan = async (req, res, next) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership Plan not found' });
    }

    applyPlanFields(plan, req.body);
    await plan.save();

    res.json({
      success: true,
      message: 'Membership Plan updated successfully',
      plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete Membership Plan
// @route DELETE /api/super-admin/plans/:id
exports.deletePlan = async (req, res, next) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership Plan not found' });
    }

    await plan.deleteOne();

    res.json({
      success: true,
      message: 'Membership Plan deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Public active membership plans (for expired admin renewal page)
// @route GET /api/public/membership-plans
exports.getPublicMembershipPlans = async (req, res, next) => {
  try {
    const plans = await MembershipPlan.find({ status: 'Active' })
      .select('name price durationDays description features upiId')
      .sort({ price: 1 });

    const plansWithQr = await Promise.all(
      plans.map(async (plan) => {
        const obj = plan.toObject();
        if (plan.upiId) {
          const upiString = buildUpiPayString({
            upiId: plan.upiId,
            payeeName: plan.name,
            amount: plan.price,
            note: `Membership ${plan.name}`
          });
          obj.qrCodeDataUrl = await generateQRCode(upiString);
        } else {
          obj.qrCodeDataUrl = '';
        }
        return obj;
      })
    );

    res.json({ success: true, plans: plansWithQr });
  } catch (error) {
    next(error);
  }
};
