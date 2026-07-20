const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  restaurantName: {
    type: String,
    default: 'Royal Spice Restaurant'
  },
  upiId: {
    type: String,
    default: 'royalspice@upi',
    trim: true
  },
  upiQrCode: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: '123 Gourmet Street, Foodie City'
  },
  mobile: {
    type: String,
    default: '+91 98765 43210'
  },
  gstNumber: {
    type: String,
    default: '22AAAAA0000A1Z5'
  },
  taxPercentage: {
    type: Number,
    default: 5 // 5% GST
  },
  currency: {
    type: String,
    default: '₹'
  },
  openingTime: {
    type: String,
    default: '10:00 AM'
  },
  closingTime: {
    type: String,
    default: '11:00 PM'
  },
  themeColor: {
    type: String,
    default: '#FF6B00'
  },
  soundNotification: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Setting', settingSchema);
