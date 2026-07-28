const mongoose = require('mongoose');

const planFeatureSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  group: {
    type: String,
    default: 'General',
    trim: true
  },
  menuKey: {
    type: String,
    default: 'general',
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  assignableToBranch: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

planFeatureSchema.index({ status: 1, sortOrder: 1, label: 1 });

module.exports = mongoose.model('PlanFeature', planFeatureSchema);
