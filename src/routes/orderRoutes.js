import express from 'express'
import { requireAuth, requireRestaurantAccess } from '../middleware/authMiddleware.js'
import Counter from '../models/Counter.js'
import Order from '../models/Order.js'
import {
  hasRequiredFields,
  isValidObjectId,
  normalizeOrderItems,
} from '../utils/validators.js'

const router = express.Router()

const ORDER_ID_PREFIX = 'ORD-'
const ORDER_COUNTER_NAME = 'orderId'
const ORDER_ID_START = 1001

const mergeOrderItems = (existingItems = [], incomingItems = []) => {
  const bucket = new Map()

  const pushItem = (item) => {
    const menuItemId = String(item.menuItemId || '').trim()
    const name = String(item.name || '').trim()
    const price = Number(item.price) || 0
    const qty = Number(item.qty) || 1
    const key = `${menuItemId || name}|${price}`
    const current = bucket.get(key)

    if (!current) {
      bucket.set(key, {
        menuItemId,
        name,
        price,
        qty,
      })
      return
    }

    current.qty += qty
  }

  existingItems.forEach(pushItem)
  incomingItems.forEach(pushItem)

  return Array.from(bucket.values())
}

const generateNextOrderId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: ORDER_COUNTER_NAME },
    [
      {
        $set: {
          name: ORDER_COUNTER_NAME,
          seq: {
            $add: [{ $ifNull: ['$seq', ORDER_ID_START - 1] }, 1],
          },
        },
      },
    ],
    {
      upsert: true,
      new: true,
    },
  )

  if (!counter?.seq) {
    throw new Error('Failed to generate orderId sequence')
  }

  return `${ORDER_ID_PREFIX}${counter.seq}`
}

router.post('/', async (req, res) => {
  try {
    const requiredCheck = hasRequiredFields(req.body, ['restaurantId', 'table', 'items', 'total'])

    if (!requiredCheck.isValid) {
      console.warn('[ORDER] Missing fields:', requiredCheck.missing)
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredCheck.missing.join(', ')}`,
      })
    }

    const normalizedItems = normalizeOrderItems(req.body.items)

    if (!normalizedItems.isValid) {
      console.warn('[ORDER] Invalid items payload:', normalizedItems.message)
      return res.status(400).json({
        success: false,
        message: normalizedItems.message,
      })
    }

    const table = Number(req.body.table)
    const total = Number(req.body.total)

    if (!Number.isFinite(table) || table < 1) {
      return res.status(400).json({
        success: false,
        message: 'table must be a valid number greater than or equal to 1',
      })
    }

    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({
        success: false,
        message: 'total must be a valid number greater than or equal to 0',
      })
    }

    const activeOrder = await Order.findOne({
      restaurantId: req.body.restaurantId,
      table,
      completed: { $ne: true },
    }).sort({ createdAt: -1 })

    if (activeOrder) {
      activeOrder.items = mergeOrderItems(activeOrder.items, normalizedItems.data)
      activeOrder.total = Number(activeOrder.total || 0) + total
      activeOrder.status = 'Pending'
      activeOrder.completed = false
      const updatedOrder = await activeOrder.save()

      console.log(`[ORDER] Updated existing active order: ${updatedOrder.orderId} (${updatedOrder._id})`)

      return res.status(200).json({
        success: true,
        message: 'Items added to existing active order',
        data: updatedOrder,
      })
    }

    let order

    // Retry once if unique orderId collision happens under rare race conditions.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const orderId = await generateNextOrderId()

      const orderPayload = {
        orderId,
        restaurantId: req.body.restaurantId,
        table,
        items: normalizedItems.data,
        total,
        status: req.body.status,
      }

      try {
        order = await Order.create(orderPayload)
        break
      } catch (createError) {
        const isDuplicateOrderId = createError?.code === 11000 && createError?.keyPattern?.orderId

        if (!isDuplicateOrderId || attempt === 1) {
          throw createError
        }

        console.warn('[ORDER] Duplicate orderId detected, retrying create once')
      }
    }

    if (!order) {
      throw new Error('Order creation failed')
    }
    console.log(`[ORDER] Created order: ${order.orderId} (${order._id})`)

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    })
  } catch (error) {
    console.error('[ORDER] Failed to create order:', error.message)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order',
      error: error.message,
    })
  }
})

router.get('/:restaurantId', requireAuth, requireRestaurantAccess('params', 'restaurantId'), async (req, res) => {
  try {
    const { restaurantId } = req.params

    if (!restaurantId?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'restaurantId is required',
      })
    }

    const orders = await Order.find({ restaurantId }).sort({ createdAt: -1 })
    console.log(`[ORDER] Fetched ${orders.length} orders for restaurant: ${restaurantId}`)

    return res.json({
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
    })
  } catch (error) {
    console.error('[ORDER] Failed to fetch orders:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    })
  }
})

router.get('/details/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params

    if (!orderId?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required',
      })
    }

    const order = await Order.findOne(
      { orderId: orderId.trim() },
      { orderId: 1, status: 1, completed: 1, items: 1, total: 1 },
    )

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    return res.json({
      success: true,
      message: 'Order details fetched successfully',
      data: {
        orderId: order.orderId,
        status: order.status,
        completed: order.completed,
        items: order.items,
        total: order.total,
      },
    })
  } catch (error) {
    console.error('[ORDER] Failed to fetch order details:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message,
    })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { status, completed } = req.body

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      })
    }

    const hasStatus = typeof status === 'string' && status.trim().length > 0
    const hasCompleted = typeof completed === 'boolean'

    if (!hasStatus && !hasCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Provide status or completed field to update',
      })
    }

    const updatePayload = {}

    if (hasStatus) {
      updatePayload.status = status.trim()
    }

    if (hasCompleted) {
      updatePayload.completed = completed

      // Keep status aligned with completion when client toggles completion only.
      if (completed === true && !hasStatus) {
        updatePayload.status = 'Done'
      }
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, restaurantId: req.auth.restaurantId },
      updatePayload,
      { new: true },
    )

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    console.log(`[ORDER] Updated order ${id}: ${JSON.stringify(updatePayload)}`)

    return res.json({
      success: true,
      message: 'Order updated successfully',
      data: updatedOrder,
    })
  } catch (error) {
    console.error('[ORDER] Failed to update order status:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message,
    })
  }
})

export default router
