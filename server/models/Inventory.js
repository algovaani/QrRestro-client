const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null
  },
  customItemName: {
    type: String,
    trim: true,
    default: ''
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 0
  },
  unit: {
    type: String,
    default: 'pcs',
    trim: true
  },
  isTracked: {
    type: Boolean,
    default: true
  },
  lastRestockedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

inventorySchema.index(
  { adminId: 1, branchId: 1, menuItemId: 1 },
  { unique: true, partialFilterExpression: { menuItemId: { $exists: true, $ne: null } } }
);

inventorySchema.index(
  { adminId: 1, branchId: 1, customItemName: 1 },
  { unique: true, partialFilterExpression: { customItemName: { $type: 'string', $ne: '' } } }
);

module.exports = mongoose.model('Inventory', inventorySchema);
