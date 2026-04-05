import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: [true, 'orderId is required'],
    unique: true,
    trim: true,
  },
  restaurantId: {
    type: String,
    required: [true, 'restaurantId is required'],
    trim: true,
  },
  table: {
    type: Number,
    required: [true, 'table is required'],
    min: [1, 'table must be at least 1'],
  },
  items: {
    type: [
      {
        menuItemId: {
          type: String,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        qty: {
          type: Number,
          min: 1,
          default: 1,
        },
      },
    ],
    required: [true, 'items are required'],
    validate: {
      validator: (value) => Array.isArray(value) && value.length > 0,
      message: 'items must contain at least one item',
    },
  },
  total: {
    type: Number,
    required: [true, 'total is required'],
    min: [0, 'total must be positive'],
  },
  status: {
    type: String,
    default: 'Pending',
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const Order = mongoose.model('Order', orderSchema)

export default Order
