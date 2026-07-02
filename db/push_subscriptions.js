/**
 * Push subscription queries — store/retrieve Web Push subscriptions per user.
 * Does NOT own VAPID key management or push sending logic.
 */
const { getPool } = require('./index');

async function upsertSubscription({ userId, endpoint, p256dh, auth, userAgent }) {
  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET user_agent = EXCLUDED.user_agent, created_at = NOW()
     RETURNING *`,
    [userId, endpoint, p256dh, auth, userAgent]
  );
  return r.rows[0];
}

async function deleteSubscription(userId, endpoint) {
  const pool = getPool();
  const r = await pool.query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2 RETURNING id',
    [userId, endpoint]
  );
  return r.rows.length > 0;
}

async function getSubscriptionsForUser(userId) {
  const pool = getPool();
  const r = await pool.query(
    'SELECT * FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  return r.rows;
}

async function getAllSubscriptions() {
  const pool = getPool();
  const r = await pool.query('SELECT * FROM push_subscriptions');
  return r.rows;
}

module.exports = { upsertSubscription, deleteSubscription, getSubscriptionsForUser, getAllSubscriptions };