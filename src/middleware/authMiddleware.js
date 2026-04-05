import jwt from 'jsonwebtoken'
import Owner from '../models/Owner.js'

const env = globalThis?.process?.env || {}
const getJwtSecret = () => env.JWT_SECRET || 'dev-jwt-secret-change-me'

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authorization token is required',
      })
    }

    const token = authHeader.slice('Bearer '.length).trim()

    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authorization token is required',
      })
    }

    let payload
    try {
      payload = jwt.verify(token, getJwtSecret())
    } catch (verifyError) {
      const isExpired = verifyError?.name === 'TokenExpiredError'
      return res.status(401).json({
        success: false,
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        message: isExpired ? 'Session expired. Please login again.' : 'Invalid token',
      })
    }

    const owner = await Owner.findById(payload.ownerId)

    if (!owner) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Owner account not found',
      })
    }

    const tokenVersion = Number(payload.tv || 0)

    if (tokenVersion !== Number(owner.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_VERSION_MISMATCH',
        message: 'Session is no longer valid. Please login again.',
      })
    }

    req.auth = {
      ownerId: String(owner._id),
      restaurantId: owner.restaurantId,
      email: owner.email,
      tokenVersion,
    }

    return next()
  } catch (error) {
    console.error('[AUTH] Middleware failed:', error.message)
    return res.status(500).json({
      success: false,
      code: 'AUTH_ERROR',
      message: 'Failed to validate auth token',
    })
  }
}

export const requireRestaurantAccess = (source, fieldName) => {
  return (req, res, next) => {
    const valueSource = source === 'params' ? req.params : req.body
    const requestedRestaurantId = String(valueSource?.[fieldName] || '').trim()

    if (!requestedRestaurantId) {
      return res.status(400).json({
        success: false,
        message: `${fieldName} is required`,
      })
    }

    if (requestedRestaurantId !== req.auth.restaurantId) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to access this restaurant data',
      })
    }

    return next()
  }
}
