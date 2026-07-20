const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tableName: {
    type: String,
    required: true,
    trim: true
  },
  tableNumber: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    default: 'Main Hall'
  },
  capacity: {
    type: Number,
    default: 4
  },
  qrCodeImage: {
    type: String,
    default: ''
  },
  qrUrl: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

tableSchema.index({ adminId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model('Table', tableSchema);
