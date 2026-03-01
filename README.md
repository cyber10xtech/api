# SafeSight Admin API

Node.js/Express REST API for the SafeSight Admin Panel.
Connects to Supabase using the **service role key** (bypasses all RLS).
Protects every endpoint with **JWT authentication**.

## Quick Start

```bash
npm install
cp .env.example .env
# Fill in .env with your Supabase service role key and JWT secret
npm run dev
```

Server runs on `https://webadmin.safesight.ng/api`

---

## Environment Variables (.env)

| Variable | Description |
|---|---|
| `PORT` | Port to listen on (default: 3001) |
| `JWT_SECRET` | Secret for signing JWT tokens. **Make this long and random!** |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Admin login password |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase → Settings → API |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |

---

## API Reference

### Authentication

All endpoints (except `/health` and `/api/auth/login`) require:
```
Authorization: Bearer <token>
```

#### `POST /api/auth/login`
```json
{ "email": "admin@safesight.com", "password": "yourpassword" }
```
Returns: `{ token, expiresIn, admin: { email } }`

#### `POST /api/auth/refresh` — Get a fresh token
#### `GET /api/auth/me` — Get current admin info

---

### Dashboard

#### `GET /api/dashboard`
Returns all stats in one call: counts, recent bookings, top pros.

---

### Professionals

| Method | Path | Description |
|---|---|---|
| GET | `/api/professionals` | List all. Query: `?account_type=professional\|handyman`, `?verified=true\|false`, `?search=text` |
| GET | `/api/professionals/:id` | Single professional with private contact info |
| PATCH | `/api/professionals/:id/verify` | Body: `{ "is_verified": true }` |
| DELETE | `/api/professionals/:id` | Remove profile |

---

### Customers

| Method | Path | Description |
|---|---|---|
| GET | `/api/customers` | List all. Query: `?search=text` |
| GET | `/api/customers/:id` | Customer with their bookings |
| DELETE | `/api/customers/:id` | Remove customer |

---

### Bookings

| Method | Path | Description |
|---|---|---|
| GET | `/api/bookings` | List all. Query: `?status=pending`, `?service_category=professional\|handyman`, `?search=text` |
| GET | `/api/bookings/:id` | Full booking with customer, professional, reviews |
| PATCH | `/api/bookings/:id/status` | Body: `{ "status": "confirmed" }` |
| DELETE | `/api/bookings/:id` | Remove booking |

Valid statuses: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`

---

### Reviews

| Method | Path | Description |
|---|---|---|
| GET | `/api/reviews` | List all with summary stats. Query: `?rating=1-5`, `?professional_id=uuid` |
| DELETE | `/api/reviews/:id` | Remove review |

---

### Analytics

#### `GET /api/analytics`
Returns: bookings by status, by category, top services, monthly trend, revenue trend, rating distribution, totals.

---

### Notifications

| Method | Path | Description |
|---|---|---|
| POST | `/api/notifications/broadcast` | Send to all customers, all professionals, or a specific user |
| GET | `/api/notifications` | List recent notifications |

Broadcast body:
```json
{
  "target": "all_customers",
  "title": "New Feature!",
  "message": "Check out what's new on SafeSight."
}
```
Or for a specific user:
```json
{
  "target": "user",
  "user_id": "uuid",
  "user_type": "customer",
  "title": "Your booking was confirmed",
  "message": "..."
}
```

---

## Deploying on cPanel (Node.js App)

1. Log in to cPanel → **Node.js App** (or Software → Setup Node.js App)
2. Create a new app:
   - Node version: 18+
   - Application root: `/home/yourusername/safesight-api`
   - Application URL: `api.yourdomain.com`
   - Application startup file: `src/server.js`
3. Upload all files (excluding `node_modules/`) to the app root
4. In cPanel Node.js App manager, click **Run NPM Install**
5. Set environment variables in cPanel (or upload your `.env` file)
6. Click **Start App**
7. Test: `https://api.yourdomain.com/health`

**Then update your frontend `.env`:**
```
VITE_API_URL=https://api.yourdomain.com
```
Rebuild the frontend and re-upload the `dist/` folder.

---

## Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses ALL Row Level Security. Never expose it to the browser.
- All routes are rate-limited (200 req/15min general, 10 req/15min for login).
- JWT tokens expire in 12 hours.
- CORS only allows origins listed in `ALLOWED_ORIGINS`.
