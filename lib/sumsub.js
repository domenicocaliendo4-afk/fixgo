/**
 * Sumsub integration — KYC verification for professional accounts.
 * Uses Sumsub Web SDK for client-side document capture.
 * Does NOT own: Stripe, email, general auth.
 */
const SUMBSUB_API_BASE = 'https://api.sumsub.com';
const APP_ID = process.env.SUMBSUB_APP_ID;
const SECRET_KEY = process.env.SUMBSUB_SECRET_KEY;
const WEBHOOK_SECRET = process.env.SUMBSUB_WEBHOOK_SECRET;

async function getAccessToken(userId, email) {
  const creds = Buffer.from(`${APP_ID}:${SECRET_KEY}`).toString('base64');
  const res = await fetch(`${SUMBSUB_API_BASE}/resources/accessTokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${creds}`,
    },
    body: JSON.stringify({
      userId: String(userId),
      expiresIn: 3600,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sumsub token error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.token;
}

async function createApplicant(userId, email, name) {
  const creds = Buffer.from(`${APP_ID}:${SECRET_KEY}`).toString('base64');
  const res = await fetch(`${SUMBSUB_API_BASE}/resources/applicants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${creds}`,
    },
    body: JSON.stringify({
      email,
      externalUserId: String(userId),
      firstName: name ? name.split(' ')[0] : undefined,
      lastName: name ? name.split(' ').slice(1).join(' ') : undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sumsub applicant error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.id;
}

function verifyWebhookSignature(payload, signature) {
  if (!WEBHOOK_SECRET) return true; // Skip if not configured
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

module.exports = { getAccessToken, createApplicant, verifyWebhookSignature };