/**
 * Push notification routes — Web Push subscription management + pure-Node push sending.
 * Uses Node.js built-in crypto to implement RFC 8291 Web Push protocol (no web-push dependency).
 * Mounted at /api/push
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pushDb = require('../db/push_subscriptions');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fixgo-dev-secret-change-in-production';

// ─── VAPID Key Management ─────────────────────────────────────────────────────

let _vapidPublic = null;
let _vapidPrivate = null;

function ensureVapidKeys() {
  if (_vapidPublic && _vapidPrivate) return;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    _vapidPublic = process.env.VAPID_PUBLIC_KEY;
    _vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    console.log('[push] VAPID keys loaded from env');
    return;
  }
  // Generate P-256 EC key pair for VAPID
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  _vapidPublic = urlBase64Encode(publicKey);
  _vapidPrivate = urlBase64Encode(privateKey);
  // Persist to env so restart doesn't regenerate
  process.env.VAPID_PUBLIC_KEY = _vapidPublic;
  process.env.VAPID_PRIVATE_KEY = _vapidPrivate;
  console.log('[push] VAPID keys generated at startup (first run — restart will reuse)');
}
ensureVapidKeys();

// ─── Crypto Helpers (RFC 8291 / IETF Draft-ietf-webpush-encryption-03) ─────────

function urlBase64Encode(buf) {
  return buf.toString('base64')
    .replace(/\n/g, '')
    .replace(/\/+/g, '-')
    .replace(/={1,2}$/, '');
}

function urlBase64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  return Buffer.from(padded, 'base64');
}

function hkdfSha256(salt, ikm, info, length) {
  const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
  const infoBytes = Buffer.from(info, 'utf8');
  const counter = Buffer.from([1]);
  const raw = crypto.createHmac('sha256', prk).update(Buffer.concat([infoBytes, counter])).digest();
  return raw.slice(0, length);
}

// Derive shared secret via ECDH P-256 with the subscription's p256dh key
function deriveSharedSecret(privateKeyDer, peerPublicKeyDer) {
  const privateKey = crypto.createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' });
  const peerKey = crypto.createPublicKey({ key: peerPublicKeyDer, format: 'der', type: 'spki' });
  return crypto.diffieHellman({ privateKey, publicKey: peerKey });
}

// Encrypt payload using ECIES: ECDH + HKDF-SHA256 + AES-128-GCM
// audience = origin of the push service endpoint
function eciesEncrypt(payloadBuf, peerPublicKeyDer, sharedSecret) {
  const SALT = Buffer.from('FixGoPushV1');
  const PRK = hkdfSha256(SALT, sharedSecret, 'Content-Encoding: nonce'.normalize('utf8'), 32);
  const nonce = hkdfSha256(SALT, PRK, 'Content-Encoding: nonce'.normalize('utf8'), 12);
  const CONTENT_ENCODING_KEY = hkdfSha256(SALT, sharedSecret, 'Content-Encoding: key'.normalize('utf8'), 16);

  const cipher = crypto.createCipheriv('aes-128-gcm', CONTENT_ENCODING_KEY, nonce);
  const encrypted = Buffer.concat([cipher.update(payloadBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, encrypted]);
}

// Build the "Authorization: vapid" header value
function buildVapidAuth(audience, subject) {
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const headerRaw = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'VAPID' })).toString('base64url');
  const claimsRaw = Buffer.from(JSON.stringify({
    aud: audience,
    sub: subject,
    exp: expiry,
  })).toString('base64url');

  // Sign with ECDSA P-256 using VAPID private key
  const signInput = headerRaw + '.' + claimsRaw;
  const signingInputBuf = Buffer.from(signInput, 'utf8');
  const vapidPrivDer = urlBase64Decode(_vapidPrivate);
  const privateKey = crypto.createPrivateKey({ key: vapidPrivDer, format: 'der', type: 'pkcs8' });
  const signature = crypto.sign(null, signingInputBuf, privateKey);
  const sigB64 = urlBase64Encode(signature);

  return `vapid t=${signInput}.${sigB64}, k=${_vapidPublic}`;
}

// Extract audience (origin) from a push endpoint URL
function audienceFromEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol + '//' + url.host;
  } catch {
    return null;
  }
}

// ─── Push Sending ──────────────────────────────────────────────────────────────

async function sendPush(sub, payloadObj) {
  const payloadBuf = Buffer.from(JSON.stringify(payloadObj), 'utf8');
  const peerPubDer = urlBase64Decode(sub.p256dh);

  const shared = deriveSharedSecret(urlBase64Decode(_vapidPrivate), peerPubDer);
  const encrypted = eciesEncrypt(payloadBuf, peerPubDer, shared);

  const audience = audienceFromEndpoint(sub.endpoint);
  const subject = 'mailto:support@fixgo.app';
  const authHeader = buildVapidAuth(audience, subject);
  const cryptoKeyHeader = `key=p256dh=${sub.p256dh}`;
  const ttl = 86400;

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'TTL': String(ttl),
      'Topic': 'booking-update',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': authHeader,
      'Crypto-Key': cryptoKeyHeader,
    },
    body: encrypted,
  });

  return { status: res.status, ok: res.ok };
}

// ─── Express Routes ───────────────────────────────────────────────────────────

router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: _vapidPublic });
});

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/push/subscribe
router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys, userAgent } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint, keys.p256dh, and keys.auth required' });
  }
  try {
    await pushDb.upsertSubscription({
      userId: req.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || req.headers['user-agent'] || null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] subscribe error:', err.message);
    res.status(500).json({ error: 'Failed to store subscription' });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  try {
    const deleted = await pushDb.deleteSubscription(req.userId, endpoint);
    res.json({ ok: true, removed: deleted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// GET /api/push/status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const subs = await pushDb.getSubscriptionsForUser(req.userId);
    res.json({ subscribed: subs.length > 0, count: subs.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// ─── Push Trigger Functions (called from other routes) ────────────────────────

async function sendPushToUser(userId, payload) {
  try {
    const subs = await pushDb.getSubscriptionsForUser(userId);
    const results = [];
    for (const sub of subs) {
      try {
        const result = await sendPush(sub, payload);
        if (result.status === 404 || result.status === 410) {
          await pushDb.deleteSubscription(userId, sub.endpoint).catch(() => {});
        }
        results.push({ endpoint: sub.endpoint, ok: result.ok });
      } catch (err) {
        console.error(`[push] send failed to ${sub.endpoint}: ${err.message}`);
        results.push({ endpoint: sub.endpoint, ok: false, error: err.message });
      }
    }
    return results;
  } catch (err) {
    console.error('[push] sendPushToUser error:', err.message);
    return [];
  }
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function onBookingConfirmed({ userId, professionalName, serviceType, scheduledAt }) {
  await sendPushToUser(userId, {
    title: '✅ Prenotazione confermata!',
    body: `Il professionista ${professionalName || 'assegnato'} confermerà a breve.${fmtTime(scheduledAt) ? ' ' + fmtTime(scheduledAt) : ''}`,
    icon: '/favicon.ico',
    tag: 'booking-confirmed',
    data: { url: '/#/bookings' },
  });
}

async function onBookingAccepted({ userId, professionalName, serviceType, scheduledAt }) {
  await sendPushToUser(userId, {
    title: '👍 Prenotazione accettata!',
    body: `${professionalName || 'Il professionista'} ha accettato${fmtTime(scheduledAt) ? ' — ' + fmtTime(scheduledAt) : ''}`,
    icon: '/favicon.ico',
    tag: 'booking-accepted',
    data: { url: '/#/bookings' },
  });
}

async function onBookingDeclined({ userId, professionalName, serviceType }) {
  await sendPushToUser(userId, {
    title: '⛔ Prenotazione rifiutata',
    body: `${professionalName || 'Il professionista'} non è disponibile. Scegli un altro professionista.`,
    icon: '/favicon.ico',
    tag: 'booking-declined',
    data: { url: '/#/' },
  });
}

module.exports = router;
module.exports.sendPushToUser = sendPushToUser;
module.exports.onBookingConfirmed = onBookingConfirmed;
module.exports.onBookingAccepted = onBookingAccepted;
module.exports.onBookingDeclined = onBookingDeclined;