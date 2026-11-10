const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

// Aplica en orden alfabético los .sql que falten, cada uno en su propia transacción.
async function runMigrations(pool, dir = MIGRATIONS_DIR) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nombre TEXT PRIMARY KEY,
    aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await pool.query('SELECT nombre FROM schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.nombre));
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const nuevas = [];
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = fs.readFileSync(path.join(dir, archivo), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      nuevas.push(archivo);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Migración ${archivo} falló: ${e.message}`);
    } finally {
      client.release();
    }
  }
  if (nuevas.length) console.log('Migraciones aplicadas:', nuevas.join(', '));
  return nuevas;
}

module.exports = { runMigrations, MIGRATIONS_DIR };
