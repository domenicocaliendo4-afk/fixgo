/**
 * Booking queries — create, fetch, update, cancel.
 * Does NOT own auth or professional logic.
 */
const { getPool } = require('./index');

async function createBooking({ userId, professionalId, professionalName, professionalPhone, serviceType, scheduledAt, address, notes, price }) {
  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO bookings (user_id, professional_id, professional_name, professional_phone, service_type, scheduled_at, address, notes, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING *`,
    [userId, professionalId, professionalName, professionalPhone, serviceType, scheduledAt, address, notes, price]
  );
  return r.rows[0];
}

async function getBookingByIdAdmin(bookingId) {
  const pool = getPool();
  const r = await pool.query(
    `SELECT b.*, p.name as professional_name, p.phone as professional_phone, p.email as professional_email
     FROM bookings b LEFT JOIN professionals p ON b.professional_id = p.id WHERE b.id = $1`,
    [bookingId]
  );
  return r.rows[0] || null;
}

async function getBookingById(bookingId, userId) {
  const pool = getPool();
  const r = await pool.query(
    `SELECT b.*, p.service_type as pro_service_type, p.name as pro_name, p.phone as pro_phone, p.email as pro_email, p.rating as pro_rating
     FROM bookings b
     LEFT JOIN professionals p ON b.professional_id = p.id
     WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  );
  return r.rows[0] || null;
}

async function getBookingsForUser(userId) {
  const pool = getPool();
  const r = await pool.query(
    `SELECT b.*, p.name as pro_name, p.rating as pro_rating
     FROM bookings b
     LEFT JOIN professionals p ON b.professional_id = p.id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return r.rows;
}

async function cancelBooking(bookingId, userId) {
  const pool = getPool();
  const r = await pool.query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2 RETURNING *`,
    [bookingId, userId]
  );
  return r.rows[0] || null;
}

async function updateStatus(bookingId, status) {
  const pool = getPool();
  const r = await pool.query(
    `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
    [status, bookingId]
  );
  return r.rows[0] || null;
}

async function updatePaymentIntent(bookingId, paymentIntent, paymentStatus) {
  const pool = getPool();
  const r = await pool.query(
    `UPDATE bookings SET payment_intent = $1, payment_status = $2 WHERE id = $3 RETURNING *`,
    [paymentIntent, paymentStatus, bookingId]
  );
  return r.rows[0] || null;
}

async function updatePaymentStatus(bookingId, paymentStatus) {
  const pool = getPool();
  const r = await pool.query(
    `UPDATE bookings SET payment_status = $1 WHERE id = $2 RETURNING *`,
    [paymentStatus, bookingId]
  );
  return r.rows[0] || null;
}

module.exports = { createBooking, getBookingById, getBookingByIdAdmin, getBookingsForUser, cancelBooking, updateStatus, updatePaymentIntent, updatePaymentStatus };