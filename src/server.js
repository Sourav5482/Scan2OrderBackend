import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import authRoutes from './routes/authRoutes.js'
import connectDB from './config/db.js'
import menuRoutes from './routes/menuRoutes.js'
import orderRoutes from './routes/orderRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://scan2-order.vercel.app'
const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/$/, '')

const ALLOWED_ORIGINS = new Set([
  normalizeOrigin(FRONTEND_URL),
  'https://scan2-order.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
])

const isLocalDevOrigin = (origin) => {
  try {
    const parsed = new URL(origin)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

const isVercelOrigin = (origin) => {
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app')
  } catch {
    return false
  }
}

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin)

    if (!origin || ALLOWED_ORIGINS.has(normalizedOrigin) || isLocalDevOrigin(origin) || isVercelOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('CORS origin not allowed'))
  },
  credentials: true,
}))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
  })
})

app.use('/menu', menuRoutes)
app.use('/order', orderRoutes)
app.use('/auth', authRoutes)

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

const startServer = async () => {
  try {
    await connectDB()

    app.listen(PORT, () => {
      console.log(`[SERVER] Restaurant QR backend running on port ${PORT}`)
    })
  } catch (error) {
    console.error('[SERVER] Startup failed:', error.message)
    process.exit(1)
  }
}

startServer()
