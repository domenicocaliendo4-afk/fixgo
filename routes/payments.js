/**
 * Payment routes — Stripe Checkout Session creation and webhook handling.
 * Mounted at /api/payments
 */
const express = require('express');
const router = express.Router();
const { createCheckoutSession, verifyWebhookSignature } = require('../lib/stripe');
const bookingsDb = require('../db/bookings');
const usersDb = require('../db/users');
const push = require('../routes/push');

// Auth middleware (reused from api.js — extract later if it grows)
const JWT_SECRET = process.env.JWT_SECRET || 'fixgo-dev-secret-change-in-production';
const jwt = require('jsonwebtoken');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function getBaseUrl(req) {
  const forwarded = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-host'];
  if (forwarded) return `${req.headers['x-forwarded-proto'] || 'https'}://${forwarded}`;
  return `${req.protocol}://${req.get('host')}`;
}

// POST /api/payments/create-checkout-session
// Body: { bookingId }
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId required' });

  try {
    const booking = await bookingsDb.getBookingById(parseInt(bookingId, 10), req.userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const user = await usersDb.getUserById(req.userId);
    const base = getBaseUrl(req);
    const successUrl = `${base}/booking/pay/success/${bookingId}`;
    const cancelUrl = `${base}/booking/confirm/${bookingId}`;

    // Demo mode: no Stripe key configured — mark booking as paid and skip checkout
    if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_TEST_SECRET_KEY) {
      await bookingsDb.updatePaymentIntent(bookingId, `demo_${Date.now()}`, 'paid');
      return res.json({ url: successUrl, sessionId: null, demo: true });
    }

    const session = await createCheckoutSession({
      bookingId,
      userEmail: user?.email || null,
      successUrl,
      cancelUrl,
    });

    // Store payment intent on the booking
    await bookingsDb.updatePaymentIntent(bookingId, session.id, 'pending');

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('create-checkout-session error:', err.message);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

// POST /api/payments/webhook
// Raw body required — see express.raw() middleware note below
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: 'Missing stripe-signature header or STRIPE_WEBHOOK_SECRET' });
  }

  let event;
  try {
    event = verifyWebhookSignature(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: err.message });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        const id = parseInt(bookingId, 10);
        await bookingsDb.updatePaymentStatus(id, 'paid');
        await bookingsDb.updateStatus(id, 'confirmed');
        // Send push notification to user
        const booking = await bookingsDb.getBookingByIdAdmin(id).catch(() => null);
        if (booking?.user_id) {
          push.onBookingConfirmed({
            userId: booking.user_id,
            professionalName: booking.professional_name,
            serviceType: booking.service_type,
            scheduledAt: booking.scheduled_at,
            address: booking.address,
          }).catch(err => console.error('[push] booking confirmed push error:', err.message));
        }
        console.log(`Payment succeeded for booking ${bookingId}`);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const bookingId = pi.metadata?.booking_id;
      if (bookingId) {
        await bookingsDb.updatePaymentStatus(parseInt(bookingId, 10), 'failed');
        console.log(`Payment failed for booking ${bookingId}`);
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;
module.exports.rawBodyMiddleware = express.raw({ type: 'application/json' });