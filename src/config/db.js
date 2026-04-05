import mongoose from 'mongoose'

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI

  if (!mongoUri) {
    console.error('[DB] MONGO_URI is not defined in environment variables')
    throw new Error('MONGO_URI is required')
  }

  try {
    await mongoose.connect(mongoUri)
    console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}`)
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error.message)
    throw error
  }
}

export default connectDB
