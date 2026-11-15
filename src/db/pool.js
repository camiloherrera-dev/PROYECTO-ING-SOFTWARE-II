const { Pool } = require('pg');
const { databaseUrl, dbPoolMax } = require('../config/env');

// No se conecta hasta la primera consulta: los tests que cargan la app no abren conexiones.
const pool = new Pool({
  connectionString: databaseUrl,
  max: dbPoolMax,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  statement_timeout: 5000,
});
pool.on('error', (e) => console.error('PostgreSQL error:', e.message));

async function connectDb() {
  await pool.query('SELECT 1');
  console.log('PostgreSQL connection successful');
}

module.exports = { pool, connectDb };