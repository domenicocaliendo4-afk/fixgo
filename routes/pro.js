// Pro API routes — pro dashboard, bookings, earnings, availability
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/index');
const professionalsDb = require('../db/professionals');
const bookingsDb = require('../db/bookings');
const { sendBookingEmails } = require('../lib/notifications');
const push = require('../routes/push');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fixgo-dev-secret-change-in-production';

async function requirePro(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    if (decoded.role !== 'professional') {
      return res.status(403).json({ error: 'Professional access required' });
    }
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/pro/bookings — pending and confirmed bookings for this pro
router.get('/bookings', requirePro, async (req, res) => {
  try {
    const bookings = await professionalsDb.getBookingsForPro(req.userId);
    res.json({ bookings });
  } catch (err) {
    console.error('pro bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH /api/pro/bookings/:id — accept or decline
router.patch('/bookings/:id', requirePro, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be accepted or declined' });
    }

    const r = await pool.query(
      `UPDATE bookings SET status = $1 WHERE id = $2 AND professional_id IN (SELECT id FROM professionals WHERE user_id = $3) RETURNING *`,
      [status, req.params.id, req.userId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    const booking = r.rows[0];

    // Send confirmation email to client if accepted
    if (status === 'accepted') {
      const userRows = await pool.query('SELECT email, name FROM users WHERE id = $1', [booking.user_id]);
      if (userRows.rows.length > 0) {
        const user = userRows.rows[0];
        sendBookingEmails({
          userEmail: user.email,
          userName: user.name || booking.client_name || 'Cliente',
          proEmail: null,
          proName: booking.professional_name || null,
          booking,
        }).catch(err => console.error('pro accept email error:', err.message));
        // Push: booking accepted
        push.onBookingAccepted({
          userId: booking.user_id,
          professionalName: booking.professional_name,
          serviceType: booking.service_type,
          scheduledAt: booking.scheduled_at,
        }).catch(err => console.error('[push] booking accepted error:', err.message));
      }
    } else if (status === 'declined') {
      // Push: booking declined
      push.onBookingDeclined({
        userId: booking.user_id,
        professionalName: booking.professional_name,
        serviceType: booking.service_type,
      }).catch(err => console.error('[push] booking declined error:', err.message));
    }

    res.json({ booking });
  } catch (err) {
    console.error('pro accept/decline error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// PATCH /api/pro/profile — update availability toggle
router.patch('/profile', requirePro, async (req, res) => {
  try {
    const { is_available } = req.body;
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ error: 'is_available boolean required' });
    }
    const r = await pool.query(
      'UPDATE professionals SET is_available = $1 WHERE user_id = $2 RETURNING *',
      [is_available, req.userId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }
    res.json({ professional: r.rows[0] });
  } catch (err) {
    console.error('pro profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/pro/earnings — earnings summary for current month
router.get('/earnings', requirePro, async (req, res) => {
  try {
    const earnings = await professionalsDb.getEarnings(req.userId);
    res.json({ earnings });
  } catch (err) {
    console.error('pro earnings error:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

module.exports = router;