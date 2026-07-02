/**
 * Database pool singleton. Only file that may construct new Pool().
 * All query access goes through named functions in db/*.js.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

function getPool() {
  return pool;
}

module.exports = { getPool };