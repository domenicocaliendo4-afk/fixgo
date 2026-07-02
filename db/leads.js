/**
 * Lead capture persistence.
 * Owns: insert, find by email.
 * Does NOT own: email validation, deduplication logic.
 */
const { getPool } = require('./index');

async function createLead(email) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO leads (email) VALUES ($1) RETURNING id, email, created_at`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0];
}

async function findLeadByEmail(email) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, email, created_at FROM leads WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );
  return result.rows[0] || null;
}

module.exports = { createLead, findLeadByEmail };