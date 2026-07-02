// Users DB queries — auth & profile only
const pool = require('./index');

async function getUserById(id) {
  const r = await pool.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function getUserByEmail(email) {
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0] || null;
}

async function createUser(email, passwordHash, name, role = 'client') {
  const r = await pool.query(
    'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
    [email, passwordHash, name, role]
  );
  return r.rows[0];
}

async function updateUserName(userId, name) {
  await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, userId]);
}

async function createAuthToken(userId, token, expiresAt) {
  await pool.query(
    'INSERT INTO auth_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

async function getAuthToken(token) {
  const r = await pool.query(
    'SELECT at.id, at.user_id, at.expires_at, u.email, u.name, u.role FROM auth_tokens at JOIN users u ON u.id = at.user_id WHERE at.token = $1 AND at.expires_at > NOW()', [token]
  );
  return r.rows[0] || null;
}

async function deleteAuthToken(token) {
  await pool.query('DELETE FROM auth_tokens WHERE token = $1', [token]);
}

async function deleteUserTokens(userId) {
  await pool.query('DELETE FROM auth_tokens WHERE user_id = $1', [userId]);
}

async function createPasswordReset(userId, token, expiresAt) {
  await pool.query(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

async function getPasswordReset(token) {
  const r = await pool.query(
    'SELECT * FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()', [token]
  );
  return r.rows[0] || null;
}

async function markPasswordResetUsed(resetId) {
  await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [resetId]);
}

async function updateUserPassword(userId, passwordHash) {
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

module.exports = {
  getUserById, getUserByEmail, createUser, updateUserName,
  createAuthToken, getAuthToken, deleteAuthToken, deleteUserTokens,
  createPasswordReset, getPasswordReset, markPasswordResetUsed, updateUserPassword,
};