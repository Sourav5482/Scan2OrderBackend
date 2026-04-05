# Scan2Order Backend

Express + MongoDB backend for Scan2Order.

## Tech Stack

- Node.js (ESM)
- Express
- MongoDB + Mongoose
- JWT auth

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file from template:

```bash
cp .env.example .env
```

3. Fill required variables:

- `PORT` (default: `5000`)
- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL` (your deployed frontend URL)

4. Run locally:

```bash
npm run dev
```

## Production Run

```bash
npm start
```

## Health Check

- `GET /health`

## API Base Routes

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/signout-all`
- `GET /menu/:restaurantId`
- `POST /menu`
- `PATCH /menu/:menuId`
- `DELETE /menu/:menuId`
- `POST /order`
- `GET /order/:orderId`
- `PATCH /order/:orderId`

## Deploy Checklist

1. Set all required environment variables.
2. Set `FRONTEND_URL=https://scan2-order.vercel.app` (or your active frontend URL).
3. Ensure MongoDB network access allows your deploy host.
4. Use `npm start` as start command.

## Tests

```bash
npm run test:auth
npm run test:order-lifecycle
```
