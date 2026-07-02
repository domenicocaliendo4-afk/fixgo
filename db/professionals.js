/**
 * Professional queries — lat/lng, nearby search, ratings.
 * Does NOT own auth or booking logic.
 */
const { getPool } = require('./index');

async function getNearby({ lat, lng, serviceType, limit = 20 }) {
  const pool = getPool();
  const base = `
    SELECT p.*,
      (6371 * acos(
        LEAST(1, GREATEST(-1,
          COS(RADIANS($1)) * COS(RADIANS(p.lat)) *
          COS(RADIANS(p.lng) - RADIANS($2)) +
          SIN(RADIANS($1)) * SIN(RADIANS(p.lat))
        ))
      )) AS distance_km,
      COALESCE(AVG(r.rating), p.rating) AS rating,
      COUNT(r.id) AS review_count
    FROM professionals p
    LEFT JOIN reviews r ON r.professional_id = p.id
    WHERE p.verified = true
      AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    GROUP BY p.id
  `;

  let query;
  let params;
  if (serviceType) {
    query = `${base} AND p.service_type = $3 ORDER BY distance_km ASC, rating DESC LIMIT $4`;
    params = [lat, lng, serviceType, limit];
  } else {
    query = `${base} ORDER BY distance_km ASC, rating DESC LIMIT $3`;
    params = [lat, lng, limit];
  }

  const r = await pool.query(query, params);
  return r.rows.filter(row => parseFloat(row.distance_km) <= 50);
}

async function getProByUserId(userId) {
  const pool = getPool();
  const r = await pool.query('SELECT * FROM professionals WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

async function getBookingsForPro(userId) {
  const pool = getPool();
  const r = await pool.query(
    `SELECT b.*, u.name as client_name, u.email as client_email
     FROM bookings b
     JOIN professionals p ON b.professional_id = p.id
     JOIN users u ON b.user_id = u.id
     WHERE p.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return r.rows;
}

async function updateVerificationStatus(userId, status) {
  const pool = getPool();
  const r = await pool.query(
    'UPDATE professionals SET verification_status = $1 WHERE user_id = $2 RETURNING *',
    [status, userId]
  );
  return r.rows[0] || null;
}

async function getProVerificationStatus(userId) {
  const pool = getPool();
  const r = await pool.query(
    'SELECT id, user_id, verification_status FROM professionals WHERE user_id = $1',
    [userId]
  );
  return r.rows[0] || null;
}

async function getEarnings(userId) {
  const pool = getPool();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const r = await pool.query(
    `SELECT b.*, u.name as client_name
     FROM bookings b
     JOIN professionals p ON b.professional_id = p.id
     JOIN users u ON b.user_id = u.id
     WHERE p.user_id = $1
       AND b.status IN ('accepted', 'confirmed', 'paid')
       AND b.created_at >= $2
     ORDER BY b.created_at DESC`,
    [userId, startOfMonth]
  );

  const totalEarned = r.rows.reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);
  const platformFee = 10;
  const netEarnings = r.rows.reduce((sum, b) => {
    const gross = parseFloat(b.price) || 0;
    return sum + Math.max(0, gross - platformFee);
  }, 0);

  return {
    bookings: r.rows,
    totalEarned,
    platformFees: r.rows.length * platformFee,
    netEarnings,
    currency: 'EUR',
    month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
  };
}

module.exports = { getNearby, getProByUserId, getBookingsForPro, getEarnings, updateVerificationStatus, getProVerificationStatus };