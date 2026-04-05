import express from 'express'
import { requireAuth, requireRestaurantAccess } from '../middleware/authMiddleware.js'
import Menu from '../models/Menu.js'
import { hasRequiredFields, isValidObjectId } from '../utils/validators.js'

const router = express.Router()

router.post('/', requireAuth, requireRestaurantAccess('body', 'restaurantId'), async (req, res) => {
  try {
    const requiredCheck = hasRequiredFields(req.body, ['restaurantId', 'name', 'category', 'price', 'image'])

    if (!requiredCheck.isValid) {
      console.warn('[MENU] Missing fields:', requiredCheck.missing)
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${requiredCheck.missing.join(', ')}`,
      })
    }

    const menuItem = await Menu.create({
      ...req.body,
      category: String(req.body.category).trim(),
    })
    console.log(`[MENU] Item created: ${menuItem._id}`)

    return res.status(201).json({
      success: true,
      message: 'Menu item added successfully',
      data: menuItem,
    })
  } catch (error) {
    console.error('[MENU] Failed to create item:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to add menu item',
      error: error.message,
    })
  }
})

router.get('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params

    if (!restaurantId?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'restaurantId is required',
      })
    }

    const items = await Menu.find({ restaurantId }).sort({ createdAt: -1 })
    console.log(`[MENU] Fetched ${items.length} items for restaurant: ${restaurantId}`)

    return res.json({
      success: true,
      message: 'Menu fetched successfully',
      data: items,
    })
  } catch (error) {
    console.error('[MENU] Failed to fetch items:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items',
      error: error.message,
    })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { isAvailable, name, category, price, image } = req.body

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID',
      })
    }

    const updatePayload = {}

    if (isAvailable !== undefined) {
      if (typeof isAvailable !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isAvailable must be boolean',
        })
      }

      updatePayload.isAvailable = isAvailable
    }

    if (name !== undefined) {
      const parsed = String(name).trim()

      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'name cannot be empty',
        })
      }

      updatePayload.name = parsed
    }

    if (category !== undefined) {
      const parsed = String(category).trim()

      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'category cannot be empty',
        })
      }

      updatePayload.category = parsed
    }

    if (price !== undefined) {
      const parsed = Number(price)

      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({
          success: false,
          message: 'price must be a valid positive number',
        })
      }

      updatePayload.price = parsed
    }

    if (image !== undefined) {
      const parsed = String(image).trim()

      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'image cannot be empty',
        })
      }

      updatePayload.image = parsed
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      })
    }

    const updatedItem = await Menu.findOneAndUpdate(
      { _id: id, restaurantId: req.auth.restaurantId },
      updatePayload,
      { new: true },
    )

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      })
    }

    console.log(`[MENU] Updated item ${id}`)

    return res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: updatedItem,
    })
  } catch (error) {
    console.error('[MENU] Failed to update availability:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to update menu availability',
      error: error.message,
    })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID',
      })
    }

    const deletedItem = await Menu.findOneAndDelete({
      _id: id,
      restaurantId: req.auth.restaurantId,
    })

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      })
    }

    console.log(`[MENU] Deleted item ${id}`)

    return res.json({
      success: true,
      message: 'Menu item deleted successfully',
      data: deletedItem,
    })
  } catch (error) {
    console.error('[MENU] Failed to delete item:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete menu item',
      error: error.message,
    })
  }
})

export default router
