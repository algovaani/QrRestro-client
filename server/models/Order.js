const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  },
  itemName: {
    type: String,
    required: true
  },
  size: {
    type: String,
    enum: ['Half', 'Full', 'Fixed'],
    default: 'Full'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  instructions: {
    type: String,
    default: ''
  }
});

const orderSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  tableNumber: {
    type: String,
    required: true
  },
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  customerName: {
    type: String,
    default: 'Guest'
  },
  customerMobile: {
    type: String,
    default: ''
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },
  orderStatus: {
    type: String,
    enum: ['New', 'Confirmed', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled'],
    default: 'New'
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Pending', 'Paid', 'Failed'],
    default: 'Unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Cash', 'Card'],
    default: 'UPI'
  },
  transactionId: {
    type: String,
    default: ''
  },
  paidAt: {
    type: Date,
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  review: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
