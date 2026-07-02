/**
 * Analytics event persistence.
 * Does NOT own: frontend tracking, dashboard queries, event processing.
 */
const pool = require('./index');

async function logEvent({ name, userId = null, metadata = null }) {
  const query = `
    INSERT INTO analytics_events (name, user_id, metadata)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `;
  await pool.query(query, [
    name,
    userId || null,
    metadata ? JSON.stringify(metadata) : null
  ]);
}

module.exports = { logEvent };