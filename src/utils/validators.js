import mongoose from 'mongoose'

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const hasRequiredFields = (payload, fields) => {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '')
  return {
    isValid: missing.length === 0,
    missing,
  }
}

export const normalizeOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      isValid: false,
      message: 'items must be a non-empty array',
      data: [],
    }
  }

  const normalizedItems = []

  for (const item of items) {
    if (typeof item === 'string') {
      const name = item.trim()

      if (!name) {
        return {
          isValid: false,
          message: 'item name cannot be empty',
          data: [],
        }
      }

      normalizedItems.push({ name, price: 0, qty: 1 })
      continue
    }

    if (!item || typeof item !== 'object') {
      return {
        isValid: false,
        message: 'each item must be a string or object',
        data: [],
      }
    }

    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const price = Number(item.price)
    const qty = item.qty === undefined ? 1 : Number(item.qty)
    const rawMenuItemId = item.menuItemId ?? item.id
    const menuItemId = rawMenuItemId === undefined || rawMenuItemId === null
      ? undefined
      : String(rawMenuItemId).trim()

    if (!name) {
      return {
        isValid: false,
        message: 'each item must include a valid name',
        data: [],
      }
    }

    if (!Number.isFinite(price) || price < 0) {
      return {
        isValid: false,
        message: 'each item must include a valid price',
        data: [],
      }
    }

    if (!Number.isFinite(qty) || qty < 1) {
      return {
        isValid: false,
        message: 'each item must include a valid qty (>= 1)',
        data: [],
      }
    }

    normalizedItems.push({
      ...(menuItemId ? { menuItemId } : {}),
      name,
      price,
      qty,
    })
  }

  return {
    isValid: true,
    message: 'items normalized successfully',
    data: normalizedItems,
  }
}
