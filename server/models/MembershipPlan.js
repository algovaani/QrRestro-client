const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  durationDays: {
    type: Number,
    required: true,
    default: 30
  },
  description: {
    type: String,
    default: ''
  },
  features: {
    type: [String],
    default: []
  },
  featureKeys: {
    type: [String],
    default: []
  },
  featureIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'PlanFeature',
    default: []
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  upiId: {
    type: String,
    default: ''
  },
  paymentQrCode: {
    type: String,
    default: ''
  },
  /** Max branches per restaurant admin. 0 = unlimited */
  maxBranches: {
    type: Number,
    default: 1,
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
