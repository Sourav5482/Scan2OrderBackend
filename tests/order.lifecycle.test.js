import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'
import test from 'node:test'

const host = '127.0.0.1'
const port = 5192
const baseUrl = `http://${host}:${port}`

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForServer = async () => {
  const deadline = Date.now() + 15000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`)

      if (response.ok) {
        return
      }
    } catch {
      // Server is still starting.
    }

    await wait(250)
  }

  throw new Error('Backend did not become ready in time')
}

const postJson = async (path, body, token) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return { response, data }
}

const putJson = async (path, body, token) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return { response, data }
}

let serverProcess = null

test.before(async () => {
  serverProcess = spawn('node', ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-order-lifecycle',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout?.on('data', () => {})
  serverProcess.stderr?.on('data', () => {})

  await waitForServer()
})

test.after(async () => {
  if (!serverProcess) {
    return
  }

  serverProcess.kill('SIGTERM')

  await new Promise((resolve) => {
    serverProcess.once('exit', () => resolve())
    setTimeout(() => resolve(), 2000)
  })
})

test('reuses active table order and creates new order after completion', async () => {
  const unique = Date.now()
  const restaurantId = `lifecycle-${unique}`
  const table = 9

  const signup = await postJson('/auth/signup', {
    restaurantId,
    ownerName: 'Lifecycle Owner',
    email: `lifecycle-${unique}@test.local`,
    password: 'secret123',
    rememberMe: false,
  })

  assert.equal(signup.response.status, 201)
  const token = signup.data?.data?.token
  assert.ok(token)

  const first = await postJson('/order', {
    restaurantId,
    table,
    total: 120,
    items: [{ name: 'Tea', price: 60, qty: 2 }],
  })

  assert.equal(first.response.status, 201)
  const firstOrderId = first.data?.data?.orderId
  const firstDbId = first.data?.data?._id
  assert.ok(firstOrderId)
  assert.ok(firstDbId)

  const second = await postJson('/order', {
    restaurantId,
    table,
    total: 80,
    items: [{ name: 'Coffee', price: 80, qty: 1 }],
  })

  assert.equal(second.response.status, 200)
  assert.equal(second.data?.data?.orderId, firstOrderId)
  assert.equal(second.data?.data?._id, firstDbId)

  const markCompleted = await putJson(`/order/${firstDbId}`, { completed: true }, token)

  assert.equal(markCompleted.response.status, 200)
  assert.equal(markCompleted.data?.data?.completed, true)

  const third = await postJson('/order', {
    restaurantId,
    table,
    total: 50,
    items: [{ name: 'Water', price: 50, qty: 1 }],
  })

  assert.equal(third.response.status, 201)
  assert.notEqual(third.data?.data?.orderId, firstOrderId)
  assert.notEqual(third.data?.data?._id, firstDbId)
  assert.equal(third.data?.data?.completed, false)
})
