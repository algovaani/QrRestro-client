const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  restaurantName: {
    type: String,
    default: 'Royal Spice Restaurant'
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  rawPassword: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['SuperAdmin', 'Admin', 'Kitchen'],
    default: 'Admin'
  },
  restaurantAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // SaaS Membership & 5-Day Free Trial Fields
  planName: {
    type: String,
    default: '5-Day Free Trial'
  },
  planStatus: {
    type: String,
    enum: ['Trialing', 'Active', 'Expired', 'Suspended'],
    default: 'Trialing'
  },
  trialEndsAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  },
  subscriptionEndsAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  },
  renewalRequested: {
    type: Boolean,
    default: false
  },
  renewalRequestDate: {
    type: Date,
    default: null
  },
  requestedPlanName: {
    type: String,
    default: ''
  },
  /** Super Admin ne membership offer bheja — tab hi admin ko Buy/Renew dikhega */
  membershipOfferSent: {
    type: Boolean,
    default: false
  },
  membershipOfferPlanName: {
    type: String,
    default: ''
  },
  membershipOfferSentAt: {
    type: Date,
    default: null
  },
  /** Payment screenshot uploaded with renewal request */
  renewalPaymentProof: {
    type: String,
    default: ''
  },
  /** Super Admin rejection reason (cleared on new request) */
  renewalRejectionReason: {
    type: String,
    default: ''
  },
  renewalRejectedAt: {
    type: Date,
    default: null
  },
  /** One-time free trial consumed — hide free plan on renewal */
  freeTrialUsed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
