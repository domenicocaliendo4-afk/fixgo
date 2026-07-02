/**
 * Verification routes — Sumsub KYC for professional accounts.
 * POST /api/verification/start — initiate Sumsub verification (pro only)
 * POST /api/verification/webhook — Sumsub webhook callback
 * GET  /api/verification/status — current status (pro only)
 * Does NOT own: general auth, bookings, email.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const professionalsDb = require('../db/professionals');
const usersDb = require('../db/users');
const { getAccessToken, createApplicant, verifyWebhookSignature } = require('../lib/sumsub');
const { sendProVerifiedEmail } = require('../lib/notifications');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fixgo-dev-secret-change-in-production';

// Middleware: require pro auth
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
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/verification/start — create Sumsub applicant + return SDK token
router.post('/start', requirePro, async (req, res) => {
  try {
    const user = await usersDb.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existingStatus = await professionalsDb.getProVerificationStatus(req.userId);
    if (existingStatus && existingStatus.verification_status === 'verified') {
      return res.json({ status: 'verified', message: 'Account già verificato' });
    }

    // Demo mode: no Sumsub credentials — approve immediately so the flow works end-to-end
    if (!process.env.SUMBSUB_APP_ID || !process.env.SUMBSUB_SECRET_KEY) {
      await professionalsDb.updateVerificationStatus(req.userId, 'verified');
      const { getPool } = require('../db/index');
      await getPool().query('UPDATE professionals SET verified = TRUE WHERE user_id = $1', [req.userId]);
      return res.json({ status: 'verified', message: 'Verifica completata (modalità demo)', demo: true });
    }

    // Create or retrieve Sumsub applicant for this user
    let applicantId;
    try {
      applicantId = await createApplicant(req.userId, user.email, user.name);
    } catch (err) {
      // If applicant already exists (409), retrieve it — handle gracefully
      if (err.message && err.message.includes('409')) {
        // Applicant exists — still need a token, try getting existing
        // For now, return error asking user to retry
        console.error('Sumsub applicant already exists for user:', req.userId);
        return res.status(409).json({ error: 'Verifica già avviata. Riprova tra qualche minuto.' });
      }
      throw err;
    }

    // Get access token for Web SDK
    let sdkToken;
    try {
      sdkToken = await getAccessToken(req.userId, user.email);
    } catch (err) {
      console.error('Sumsub token error:', err.message);
      return res.status(502).json({ error: 'Errore Sumsub, riprova più tardi' });
    }

    // Set status to in_review
    await professionalsDb.updateVerificationStatus(req.userId, 'in_review');

    res.json({
      token: sdkToken,
      status: 'in_review',
    });
  } catch (err) {
    console.error('verification/start error:', err);
    res.status(500).json({ error: 'Failed to start verification' });
  }
});

// GET /api/verification/status — current verification status for pro
router.get('/status', requirePro, async (req, res) => {
  try {
    const pro = await professionalsDb.getProVerificationStatus(req.userId);
    if (!pro) return res.status(404).json({ error: 'Professional profile not found' });
    res.json({ verification_status: pro.verification_status });
  } catch (err) {
    console.error('verification/status error:', err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// POST /api/verification/webhook — Sumsub webhook callback
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-paysera-signature'] || req.headers['x-sumsub-signature'];
    const rawBody = req.body; // Buffer from express.raw

    // Verify signature
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.warn('[verification] Invalid webhook signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { userId, reviewResult, type } = payload;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    console.log(`[verification] Webhook: type=${type} userId=${userId} reviewResult=${JSON.stringify(reviewResult)}`);

    if (type === 'applicantReviewed' || type === 'applicantPending') {
      let newStatus;

      if (reviewResult && reviewResult.reviewAnswer === 'GREEN') {
        newStatus = 'verified';
      } else if (reviewResult && reviewResult.reviewAnswer === 'RED') {
        newStatus = 'rejected';
      } else if (type === 'applicantPending') {
        newStatus = 'in_review';
      } else {
        // Unknown state — leave as is
        return res.json({ received: true });
      }

      const pro = await professionalsDb.updateVerificationStatus(parseInt(userId), newStatus);

      // Send admin notification on verified
      if (newStatus === 'verified' && pro) {
        sendProVerifiedEmail(pro).catch(err =>
          console.error('[verification] Pro verified email error:', err.message)
        );
      }

      console.log(`[verification] User ${userId} status updated to: ${newStatus}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('verification/webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;