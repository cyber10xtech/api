require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes         = require('./routes/auth');
const dashboardRoutes    = require('./routes/dashboard');
const professionalsRoutes = require('./routes/professionals');
const customersRoutes    = require('./routes/customers');
const bookingsRoutes     = require('./routes/bookings');
const reviewsRoutes      = require('./routes/reviews');
const analyticsRoutes    = require('./routes/analytics');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Strict for login
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use('/api/', limiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SafeSight Admin API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/professionals', professionalsRoutes);
app.use('/api/customers',     customersRoutes);
app.use('/api/bookings',      bookingsRoutes);
app.use('/api/reviews',       reviewsRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET  /health',
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'GET  /api/auth/me',
      'GET  /api/dashboard',
      'GET  /api/professionals',
      'GET  /api/professionals/:id',
      'PATCH /api/professionals/:id/verify',
      'DELETE /api/professionals/:id',
      'GET  /api/customers',
      'GET  /api/customers/:id',
      'DELETE /api/customers/:id',
      'GET  /api/bookings',
      'GET  /api/bookings/:id',
      'PATCH /api/bookings/:id/status',
      'DELETE /api/bookings/:id',
      'GET  /api/reviews',
      'DELETE /api/reviews/:id',
      'GET  /api/analytics',
      'POST /api/notifications/broadcast',
      'GET  /api/notifications',
    ],
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ✅  SafeSight Admin API running');
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  💚  Health: http://localhost:${PORT}/health`);
  console.log(`  🔐  Login:  POST http://localhost:${PORT}/api/auth/login`);
  console.log(`  📊  Dash:   GET  http://localhost:${PORT}/api/dashboard`);
  console.log('');
});

module.exports = app;
