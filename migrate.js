/**
 * Database Migration Runner
 *
 * Runs on every deploy via `npm run build`. Health check verified.
 *
 * How it works:
 * 1. Creates core tables (users, _migrations) - always runs, idempotent
 * 2. Reads migrations from migrations/ folder
 * 3. Runs new migrations in order (tracked in _migrations table)
 *
 * To create a new migration:
 *   Create a file in migrations/ with format: {timestamp}_{name}.js
 *   Example: migrations/1704067200000_add_products_table.js
 *
 * Migration file format:
 *   module.exports = {
 *     name: 'add_products_table',
 *     up: async (client) => {
 *       await client.query(`CREATE TABLE products (...)`);
 *     }
 *   };
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  console.log('Running migrations...');

  const client = await pool.connect();
  try {
    // 1. Create migration tracking table (always first)
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Core tables (idempotent - safe to run every time)
    await runCoreMigrations(client);

    // 3. Run migrations from migrations/ folder
    await runFolderMigrations(client);

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Core tables that every app needs.
 * These use CREATE IF NOT EXISTS so they're safe to run repeatedly.
 */
async function runCoreMigrations(client) {
  // Users table with subscription support
  // Used by Polsia for syncing end-user subscription status
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      password_hash VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      -- Subscription fields (synced by Polsia when customer subscribes)
      stripe_subscription_id VARCHAR(255),
      subscription_status VARCHAR(50),
      subscription_plan VARCHAR(255),
      subscription_expires_at TIMESTAMPTZ,
      subscription_updated_at TIMESTAMPTZ
    )
  `);

  // Unique constraint on email (required for UPSERT)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email))
  `);

  // Index for subscription lookups
  await client.query(`
    CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx ON users (stripe_subscription_id)
  `);

  // Role column (client | professional) — required by auth routes
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'client'
  `);

  // Auth tokens (server-side session tokens)
  await client.query(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Password resets
  await client.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(128) NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Professionals
  await client.query(`
    CREATE TABLE IF NOT EXISTS professionals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      service_type VARCHAR(50) NOT NULL,
      bio TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
      completed_jobs INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bookings
  await client.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
      professional_name VARCHAR(255),
      professional_phone VARCHAR(50),
      service_type VARCHAR(50) NOT NULL,
      scheduled_at TIMESTAMPTZ,
      address TEXT,
      notes TEXT,
      price NUMERIC(10,2),
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      payment_intent VARCHAR(255),
      payment_status VARCHAR(30),
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Reviews
  await client.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      professional_id INTEGER REFERENCES professionals(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Review reports
  await client.query(`
    CREATE TABLE IF NOT EXISTS review_reports (
      id SERIAL PRIMARY KEY,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (review_id, reporter_user_id)
    )
  `);

  // Leads (landing page email capture)
  await client.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Push subscriptions
  await client.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT,
      auth TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, endpoint)
    )
  `);

  // Analytics events
  await client.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      user_id INTEGER,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed demo verified professionals (Milan pilot districts) if table is empty
  const proCount = await client.query('SELECT COUNT(*)::int AS n FROM professionals');
  if (proCount.rows[0].n === 0) {
    console.log('Seeding demo professionals (Milan)...');
    await client.query(`
      INSERT INTO professionals (name, phone, email, service_type, bio, lat, lng, verified, verification_status, rating, completed_jobs) VALUES
      ('Marco Bianchi',   '+39 340 111 2233', 'marco.bianchi@fixgo.demo',   'idraulica',    'Idraulico certificato, 12 anni di esperienza. Specializzato in perdite e sostituzioni urgenti.', 45.4526, 9.1750, TRUE, 'verified', 4.9, 214),
      ('Luca Ferrari',    '+39 347 222 3344', 'luca.ferrari@fixgo.demo',    'idraulica',    'Interventi rapidi in giornata su tutta Milano. Preventivo trasparente prima di iniziare.',       45.4780, 9.2250, TRUE, 'verified', 4.7, 156),
      ('Giulia Romano',   '+39 349 333 4455', 'giulia.romano@fixgo.demo',   'elettricista', 'Elettricista qualificata. Impianti, quadri, prese e punti luce. Certificazioni a norma.',        45.4480, 9.2050, TRUE, 'verified', 4.8, 189),
      ('Andrea Colombo',  '+39 342 444 5566', 'andrea.colombo@fixgo.demo',  'elettricista', 'Pronto intervento guasti elettrici. Disponibile anche nel weekend.',                              45.4720, 9.1880, TRUE, 'verified', 4.6, 132),
      ('Sara Greco',      '+39 345 555 6677', 'sara.greco@fixgo.demo',      'carwash',      'Car wash a domicilio ecologico, senza acqua. Interni ed esterni.',                                45.4860, 9.1890, TRUE, 'verified', 4.9, 301),
      ('Davide Russo',    '+39 348 666 7788', 'davide.russo@fixgo.demo',    'carwash',      'Lavaggio auto professionale sotto casa tua. Pacchetti per SUV e van.',                            45.4600, 9.1620, TRUE, 'verified', 4.5, 98),
      ('Elena Marino',    '+39 346 777 8899', 'elena.marino@fixgo.demo',    'pulizie',      'Pulizie domestiche e per host Airbnb. Check-out cleaning in 3 ore.',                              45.4650, 9.1900, TRUE, 'verified', 4.8, 245),
      ('Paolo Gallo',     '+39 341 888 9900', 'paolo.gallo@fixgo.demo',     'altro',        'Tuttofare per micro-interventi: mensole, tende, piccole riparazioni.',                            45.4550, 9.2100, TRUE, 'verified', 4.7, 167)
    `);
  }
}

/**
 * Run migrations from migrations/ folder.
 * Each migration runs once and is tracked in _migrations table.
 */
async function runFolderMigrations(client) {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Skip if no migrations folder
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  // Get all migration files, sorted by name (timestamp prefix ensures order)
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  if (files.length === 0) {
    return;
  }

  // Get already-applied migrations
  const applied = await client.query('SELECT name FROM _migrations');
  const appliedNames = new Set(applied.rows.map(r => r.name));

  // Run pending migrations
  for (const file of files) {
    const migration = require(path.join(migrationsDir, file));
    const name = migration.name || file.replace('.js', '');

    if (appliedNames.has(name)) {
      continue; // Already applied
    }

    console.log(`Running migration: ${name}`);

    try {
      await client.query('BEGIN');
      await migration.up(client);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`Migration complete: ${name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed (${name}): ${err.message}`);
    }
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
