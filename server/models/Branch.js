const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  branchName: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  city: {
    type: String,
    default: '',
    trim: true
  },
  mobile: {
    type: String,
    default: '',
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

branchSchema.index({ adminId: 1, branchName: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
