import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth } from '../middleware/authMiddleware.js'
import Owner from '../models/Owner.js'
import { hasRequiredFields } from '../utils/validators.js'

const router = express.Router()

const env = globalThis?.process?.env || {}
const getJwtSecret = () => env.JWT_SECRET || 'dev-jwt-secret-change-me'

const signAuthToken = (owner, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : '12h'

  return jwt.sign(
    {
      ownerId: owner._id,
      restaurantId: owner.restaurantId,
      email: owner.email,
      tv: Number(owner.tokenVersion || 0),
    },
    getJwtSecret(),
    { expiresIn },
  )
}

router.post('/signup', async (req, res) => {
  try {
    const requiredCheck = hasRequiredFields(req.body, ['restaurantId', 'email', 'password'])

    if (!requiredCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredCheck.missing.join(', ')}`,
      })
    }

    const restaurantId = String(req.body.restaurantId).trim()
    const ownerName = String(req.body.ownerName ?? restaurantId).trim()
    const email = String(req.body.email).trim().toLowerCase()
    const password = String(req.body.password)
    const rememberMe = Boolean(req.body.rememberMe)

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'restaurantId cannot be empty',
      })
    }

    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      })
    }

    const existingOwner = await Owner.findOne({ email })

    if (existingOwner) {
      return res.status(409).json({
        success: false,
        message: 'Account already exists with this email',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const owner = await Owner.create({
      restaurantId,
      ownerName,
      email,
      passwordHash,
    })

    const token = signAuthToken(owner, rememberMe)

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        owner: {
          id: owner._id,
          restaurantId: owner.restaurantId,
          ownerName: owner.ownerName,
          email: owner.email,
        },
      },
    })
  } catch (error) {
    console.error('[AUTH] Signup failed:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message,
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const requiredCheck = hasRequiredFields(req.body, ['email', 'password'])

    if (!requiredCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredCheck.missing.join(', ')}`,
      })
    }

    const email = String(req.body.email).trim().toLowerCase()
    const password = String(req.body.password)
    const rememberMe = Boolean(req.body.rememberMe)

    const owner = await Owner.findOne({ email })

    if (!owner) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
    }

    const isPasswordValid = await bcrypt.compare(password, owner.passwordHash)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
    }

    const token = signAuthToken(owner, rememberMe)

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        owner: {
          id: owner._id,
          restaurantId: owner.restaurantId,
          ownerName: owner.ownerName,
          email: owner.email,
        },
      },
    })
  } catch (error) {
    console.error('[AUTH] Login failed:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message,
    })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const owner = await Owner.findById(req.auth.ownerId)

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      })
    }

    return res.json({
      success: true,
      message: 'Owner profile fetched successfully',
      data: {
        owner: {
          id: owner._id,
          restaurantId: owner.restaurantId,
          ownerName: owner.ownerName,
          email: owner.email,
        },
      },
    })
  } catch (error) {
    console.error('[AUTH] Failed to fetch profile:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch owner profile',
      error: error.message,
    })
  }
})

router.post('/signout-all', requireAuth, async (req, res) => {
  try {
    const owner = await Owner.findById(req.auth.ownerId)

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found',
      })
    }

    owner.tokenVersion = Number(owner.tokenVersion || 0) + 1
    await owner.save()

    return res.json({
      success: true,
      message: 'Signed out from all devices successfully',
    })
  } catch (error) {
    console.error('[AUTH] Failed to sign out all devices:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to sign out from all devices',
      error: error.message,
    })
  }
})

export default router
