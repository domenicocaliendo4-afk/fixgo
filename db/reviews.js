/**
 * Review queries — create, fetch by professional.
 * Does NOT own auth or booking logic.
 */
const { getPool } = require('./index');

async function createReview({ bookingId, userId, professionalId, rating, comment }) {
  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO reviews (booking_id, user_id, professional_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [bookingId, userId, professionalId, rating, comment || null]
  );
  return r.rows[0];
}

async function getReviewsForProfessional(professionalId, { rating, search } = {}) {
  const pool = getPool();
  const params = [professionalId];
  let where = 'WHERE r.professional_id = $1';

  if (rating) {
    params.push(parseInt(rating, 10));
    where += ` AND r.rating = $${params.length}`;
  }
  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where += ` AND LOWER(r.comment) LIKE $${params.length}`;
  }

  const r = await pool.query(
    `SELECT r.*, u.name as reviewer_name, b.service_type, b.completed_at,
            EXISTS(SELECT 1 FROM review_reports rr WHERE rr.review_id = r.id) AS has_reports
     FROM reviews r
     JOIN users u ON r.user_id = u.id
     JOIN bookings b ON r.booking_id = b.id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return r.rows;
}

async function getAverageRatingForProfessional(professionalId) {
  const pool = getPool();
  const r = await pool.query(
    `SELECT AVG(r.rating)::numeric(2,1) as avg_rating, COUNT(*) as review_count
     FROM reviews r
     WHERE r.professional_id = $1`,
    [professionalId]
  );
  return r.rows[0] || { avg_rating: null, review_count: 0 };
}

async function getReviewByBookingId(bookingId) {
  const pool = getPool();
  const r = await pool.query('SELECT * FROM reviews WHERE booking_id = $1', [bookingId]);
  return r.rows[0] || null;
}

async function reportReview({ reviewId, reporterUserId, reason }) {
  const pool = getPool();
  // UNIQUE(review_id, reporter_user_id) — duplicate silently ignored via ON CONFLICT DO NOTHING
  const r = await pool.query(
    `INSERT INTO review_reports (review_id, reporter_user_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (review_id, reporter_user_id) DO NOTHING
     RETURNING *`,
    [reviewId, reporterUserId, reason || null]
  );
  return r.rows[0] || null;
}

async function hasUserReportedReview({ reviewId, userId }) {
  const pool = getPool();
  const r = await pool.query(
    'SELECT 1 FROM review_reports WHERE review_id = $1 AND reporter_user_id = $2',
    [reviewId, userId]
  );
  return r.rows.length > 0;
}

module.exports = { createReview, getReviewsForProfessional, getAverageRatingForProfessional, getReviewByBookingId, reportReview, hasUserReportedReview };