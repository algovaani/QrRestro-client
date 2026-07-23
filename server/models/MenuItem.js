const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  imageData: {
    type: String,
    default: '',
    select: false
  },
  description: {
    type: String,
    default: ''
  },
  foodType: {
    type: String,
    enum: ['Veg', 'Non-Veg', 'Jain', 'Vegan'],
    default: 'Veg'
  },
  priceType: {
    type: String,
    enum: ['Only Full', 'Only Half', 'Full and Half', 'Single Fixed Price'],
    default: 'Single Fixed Price'
  },
  halfPrice: {
    type: Number,
    default: 0
  },
  fullPrice: {
    type: Number,
    default: 0
  },
  fixedPrice: {
    type: Number,
    default: 0
  },
  preparationTime: {
    type: Number,
    default: 15 // in minutes
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

menuItemSchema.index({ adminId: 1, name: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
