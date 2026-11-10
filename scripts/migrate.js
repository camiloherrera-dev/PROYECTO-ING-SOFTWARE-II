// Corre las migraciones a mano: npm run migrate
const { pool } = require('../src/db/pool');
const { runMigrations } = require('../src/db/migrate');

runMigrations(pool)
  .then(() => pool.end())
  .catch((e) => { console.error(e.message); process.exit(1); });
