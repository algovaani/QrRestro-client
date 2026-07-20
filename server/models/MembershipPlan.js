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
    default: ['Unlimited Table QR Scans', 'Real-Time KDS Kitchen', 'Dynamic UPI Payments', 'WhatsApp Invoicing']
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
