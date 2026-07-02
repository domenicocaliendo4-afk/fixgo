/**
 * Database pool singleton. Only file that may construct new Pool().
 * Exports BOTH interfaces used across the codebase:
 *   - getPool()  → for files doing: const { getPool } = require('./index')
 *   - query(...) → for files doing: const pool = require('./index'); pool.query(...)
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

function getPool() {
  return pool;
}

module.exports = {
  getPool,
  query: (...args) => pool.query(...args),
  connect: (...args) => pool.connect(...args),
};
