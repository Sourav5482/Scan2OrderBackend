import mongoose from 'mongoose'

const menuSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: [true, 'restaurantId is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'category is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price must be positive'],
    },
    image: {
      type: String,
      required: [true, 'image is required'],
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

const Menu = mongoose.model('Menu', menuSchema)

export default Menu
