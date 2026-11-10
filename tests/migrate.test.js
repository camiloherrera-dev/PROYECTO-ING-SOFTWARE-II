// Migraciones de PostgreSQL con un pool simulado (sin base de datos real)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runMigrations, MIGRATIONS_DIR } = require('../src/db/migrate');

function poolFalso(aplicadas = []) {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  const pool = {
    query: jest.fn(async (sql) => (/SELECT nombre/.test(sql)
      ? { rows: aplicadas.map((nombre) => ({ nombre })) }
      : { rows: [] })),
    connect: jest.fn().mockResolvedValue(client),
  };
  return { pool, client };
}

function carpetaCon(archivos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  Object.entries(archivos).forEach(([nombre, sql]) => fs.writeFileSync(path.join(dir, nombre), sql));
  return dir;
}

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('aplica en orden solo las migraciones que faltan', async () => {
  const dir = carpetaCon({ '002_b.sql': 'SELECT 2;', '001_a.sql': 'SELECT 1;', '003_c.sql': 'SELECT 3;' });
  const { pool, client } = poolFalso(['001_a.sql']);

  expect(await runMigrations(pool, dir)).toEqual(['002_b.sql', '003_c.sql']);
  const inserts = client.query.mock.calls.filter(([sql]) => /INSERT INTO schema_migrations/.test(sql));
  expect(inserts.map(([, params]) => params[0])).toEqual(['002_b.sql', '003_c.sql']);
});

test('sin migraciones nuevas no abre conexiones', async () => {
  const dir = carpetaCon({ '001_a.sql': 'SELECT 1;' });
  const { pool } = poolFalso(['001_a.sql']);

  expect(await runMigrations(pool, dir)).toEqual([]);
  expect(pool.connect).not.toHaveBeenCalled();
});

test('si una migración falla hace ROLLBACK y el error trae su nombre', async () => {
  const dir = carpetaCon({ '001_mala.sql': 'SQL ROTO' });
  const { pool, client } = poolFalso();
  client.query.mockImplementation(async (sql) => {
    if (sql === 'SQL ROTO') throw new Error('sintaxis');
    return { rows: [] };
  });

  await expect(runMigrations(pool, dir)).rejects.toThrow('001_mala.sql');
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  expect(client.release).toHaveBeenCalled();
});

test('las migraciones del repositorio están numeradas y en orden', () => {
  const archivos = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  expect(archivos).toEqual(['001_pedidos.sql', '002_reglas_descuento.sql']);
});
