import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'
import test from 'node:test'

const host = '127.0.0.1'
const port = 5191
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

const getJson = async (path, token) => {
  const headers = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers,
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
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-auth-routes',
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

test('GET /auth/me returns owner data with valid token', async () => {
  const unique = Date.now()
  const email = `auth-me-${unique}@test.local`

  const signup = await postJson('/auth/signup', {
    restaurantId: `rest-${unique}`,
    ownerName: 'Owner Me',
    email,
    password: 'secret123',
    rememberMe: false,
  })

  assert.equal(signup.response.status, 201)
  assert.equal(signup.data.success, true)

  const token = signup.data?.data?.token
  assert.ok(token)

  const me = await getJson('/auth/me', token)

  assert.equal(me.response.status, 200)
  assert.equal(me.data.success, true)
  assert.equal(me.data?.data?.owner?.email, email)
  assert.equal(me.data?.data?.owner?.restaurantId, `rest-${unique}`)
})

test('POST /auth/signout-all invalidates previously issued token', async () => {
  const unique = Date.now() + 1
  const email = `auth-signout-${unique}@test.local`

  const signup = await postJson('/auth/signup', {
    restaurantId: `rest-${unique}`,
    ownerName: 'Owner Signout',
    email,
    password: 'secret123',
    rememberMe: true,
  })

  assert.equal(signup.response.status, 201)
  const token = signup.data?.data?.token
  assert.ok(token)

  const signoutAll = await postJson('/auth/signout-all', {}, token)

  assert.equal(signoutAll.response.status, 200)
  assert.equal(signoutAll.data.success, true)

  const meAfterSignout = await getJson('/auth/me', token)

  assert.equal(meAfterSignout.response.status, 401)
  assert.equal(meAfterSignout.data.success, false)
  assert.equal(meAfterSignout.data.code, 'TOKEN_VERSION_MISMATCH')
})

test('POST /auth/signup accepts signup without ownerName', async () => {
  const unique = Date.now() + 2
  const email = `auth-no-owner-${unique}@test.local`

  const signup = await postJson('/auth/signup', {
    restaurantId: `rest-${unique}`,
    email,
    password: 'secret123',
    rememberMe: false,
  })

  assert.equal(signup.response.status, 201)
  assert.equal(signup.data.success, true)
  assert.equal(signup.data?.data?.owner?.restaurantId, `rest-${unique}`)
  assert.equal(signup.data?.data?.owner?.ownerName, `rest-${unique}`)
})
