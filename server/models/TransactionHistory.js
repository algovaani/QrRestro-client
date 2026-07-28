const mongoose = require('mongoose');

const transactionHistorySchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  restaurantName: {
    type: String,
    default: '',
    trim: true
  },
  adminName: {
    type: String,
    default: '',
    trim: true
  },
  type: {
    type: String,
    enum: ['membership_plan', 'feature_addon'],
    required: true,
    index: true
  },
  planName: {
    type: String,
    default: '',
    trim: true
  },
  featureKey: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
  },
  featureLabel: {
    type: String,
    default: '',
    trim: true
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Waived'],
    default: 'Paid'
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  referenceId: {
    type: String,
    default: '',
    trim: true
  },
  paidAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

transactionHistorySchema.index({ paidAt: -1, type: 1 });

module.exports = mongoose.model('TransactionHistory', transactionHistorySchema);
