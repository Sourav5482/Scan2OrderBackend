import mongoose from 'mongoose'

const ownerSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: [true, 'restaurantId is required'],
      trim: true,
    },
    ownerName: {
      type: String,
      required: [true, 'ownerName is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

const Owner = mongoose.model('Owner', ownerSchema)

export default Owner
