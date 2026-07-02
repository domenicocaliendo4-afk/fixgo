/**
 * Stripe API client — thin fetch wrapper for Checkout Sessions and webhooks.
 * Uses STRIPE_SECRET_KEY (test mode supported via STRIPE_TEST_SECRET_KEY).
 */
const STRIPE_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const STRIPE_BASE = 'https://api.stripe.com/v1';
const BOOKING_FEE_CENTS = 1000; // €10.00

function getHeaders() {
  return {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/**
 * Create a Stripe Checkout Session for a booking fee.
 * Returns { url, id } where id is the session ID (used as payment_intent).
 */
async function createCheckoutSession({ bookingId, userEmail, successUrl, cancelUrl }) {
  const params = new URLSearchParams({
    'mode': 'payment',
    'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': BOOKING_FEE_CENTS.toString(),
    'line_items[0][price_data][product_data][name]': 'Booking Fee — FixGo',
    'line_items[0][price_data][product_data][description]': `Prenotazione #${bookingId}`,
    'metadata[booking_id]': bookingId.toString(),
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'payment_intent_data[metadata][booking_id]': bookingId.toString(),
  });

  if (userEmail) {
    params.set('customer_email', userEmail);
  }

  const res = await fetch(`${STRIPE_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: getHeaders(),
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Stripe error ${res.status}`);
  }

  const session = await res.json();
  return { url: session.url, id: session.id };
}

/**
 * Verify a Stripe webhook signature and parse the event.
 * Returns the parsed Stripe event object.
 */
function verifyWebhookSignature(payload, signature, secret) {
  const crypto = require('crypto');
  const parts = Object.fromEntries(
    signature.split(',').map(part => {
      const [k, v] = part.split('=');
      return [k.trim(), v.trim()];
    })
  );
  const timestamp = parts['t'];
  const sig = parts['v1'];

  if (!timestamp || !sig) {
    throw new Error('Missing Stripe signature components');
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computed))) {
    throw new Error('Invalid Stripe webhook signature');
  }

  return JSON.parse(payload);
}

module.exports = { createCheckoutSession, verifyWebhookSignature, BOOKING_FEE_CENTS };