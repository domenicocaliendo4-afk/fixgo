/**
 * Lead capture API.
 * Owns: POST /api/leads — accepts name, email, service; stores in DB + emails notification.
 * Does NOT own: email validation rules beyond format check.
 */
const express = require('express');
const { createLead, findLeadByEmail } = require('../db/leads');
const { sendLeadNotification } = require('../lib/email');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && email.includes('@') && email.includes('.');
}

router.post('/', async (req, res) => {
  const { name, email, service } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email richiesta.' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nome richiesto.' });
  }
  if (!service) {
    return res.status(400).json({ error: 'Servizio richiesto.' });
  }

  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) {
    return res.status(400).json({ error: 'Email non valida.' });
  }

  try {
    const existing = await findLeadByEmail(trimmed);
    if (!existing) {
      await createLead(trimmed);
    }

    // Send email notification (non-blocking — log and continue)
    sendLeadNotification(name.trim(), trimmed, service).catch(err => {
      console.error('[lead-capture] Email notification failed:', err.message);
    });

    return res.status(200).json({ success: true, message: 'Iscrizione confermata!' });
  } catch (err) {
    console.error('Lead capture error:', err.message);
    return res.status(500).json({ error: 'Errore del server. Riprova.' });
  }
});

module.exports = router;