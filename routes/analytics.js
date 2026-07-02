/**
 * Analytics routes — funnel event ingestion.
 * POST /api/analytics — log a named event with optional user/metadata.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const { logEvent } = require('../db/analytics');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fixgo-dev-secret-change-in-production';

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.userId;
  } catch {
    // invalid token — continue unauthenticated
  }
  next();
}

// POST /api/analytics
// Body: { name: string, metadata?: object }
router.post('/', express.json(), optionalAuth, async (req, res) => {
  const { name, metadata } = req.body || {};
  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'name required (string, max 100 chars)' });
  }

  try {
    await logEvent({ name, userId: req.userId || null, metadata: metadata || null });
    res.json({ ok: true });
  } catch (err) {
    console.error('analytics event error:', err.message);
    // Don't fail the client — analytics is non-critical
    res.json({ ok: false });
  }
});

module.exports = router;