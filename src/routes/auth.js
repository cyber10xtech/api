const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// In-memory admin store — seeded from .env at startup
// For multi-admin setups you can move this to Supabase
let adminUsers = [];

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const hashed = await bcrypt.hash(password, 12);
  adminUsers = [{ email: email.toLowerCase(), passwordHash: hashed }];
  console.log(`✅  Admin seeded: ${email}`);
};

// Call at startup
seedAdmin();

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, expiresIn, admin: { email } }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const admin = adminUsers.find((a) => a.email === email.toLowerCase().trim());
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    success: true,
    token,
    expiresIn: '12h',
    admin: { email: admin.email },
  });
});

/**
 * POST /api/auth/refresh
 * Requires: Bearer token (still valid)
 * Returns a fresh token with a new 12h window
 */
router.post('/refresh', requireAuth, (req, res) => {
  const token = jwt.sign(
    { email: req.admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ success: true, token, expiresIn: '12h' });
});

/**
 * GET /api/auth/me
 * Returns the current admin's info
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, admin: { email: req.admin.email, role: 'admin' } });
});

module.exports = router;
