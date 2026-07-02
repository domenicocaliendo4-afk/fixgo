// Auth routes — login, register, Google OAuth, password reset, /me
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db/users');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED';
const TOKEN_TTL_HOURS = 24 * 7;
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'REDACTED';

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, PASSWORD_SALT, 100000, 64, 'sha512').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware: optional auth — sets req.user if valid token present
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded) {
    req.userId = decoded.userId;
    req.userRole = decoded.role;
  }
  next();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'client' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, name required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!['client', 'professional'].includes(role)) {
      return res.status(400).json({ error: 'Role must be client or professional' });
    }
    const existing = await db.getUserByEmail(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = hashPassword(password);
    const user = await db.createUser(email.toLowerCase().trim(), hash, name.trim(), role);

    // Professionals get a profile row immediately (unverified until KYC)
    if (role === 'professional') {
      try {
        const { getPool } = require('../db/index');
        await getPool().query(
          `INSERT INTO professionals (user_id, name, email, service_type, verified, verification_status)
           VALUES ($1, $2, $3, 'altro', FALSE, 'unverified')`,
          [user.id, user.name, user.email]
        );
      } catch (proErr) {
        console.error('professional profile creation error:', proErr.message);
      }
    }

    // Auto-login: create token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600000);
    await db.createAuthToken(user.id, token, expiresAt);
    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await db.getUserByEmail(email.toLowerCase().trim());
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600000);
    await db.createAuthToken(user.id, token, expiresAt);
    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/google — mock Google OAuth, returns JWT
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name } = req.body;
    if (!googleId || !email) {
      return res.status(400).json({ error: 'googleId and email required' });
    }
    let user = await db.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      // Auto-create Google user
      user = await db.createUser(email.toLowerCase().trim(), 'GOOGLE_AUTH', name || email.split('@')[0], 'client');
    }
    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// GET /api/auth/me — requires auth, returns current user
router.get('/me', optionalAuth, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = await db.getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await db.getUserByEmail(email.toLowerCase().trim());
    if (user) {
      // Always say "email sent" — don't reveal if user exists
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      await db.createPasswordReset(user.id, token, expiresAt);
      // In production: send email with reset link
      // For now: log it (dev mode)
      console.log(`[FIXGO] Password reset for ${email}: /api/auth/reset-password?token=${token}`);
    }
    res.json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgot password error:', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const reset = await db.getPasswordReset(token);
    if (!reset) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    const hash = hashPassword(password);
    await db.updateUserPassword(reset.user_id, hash);
    await db.markPasswordResetUsed(reset.id);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('reset password error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', optionalAuth, async (req, res) => {
  // Client should discard the token — server just acknowledges
  res.json({ message: 'Logged out' });
});

module.exports = router;