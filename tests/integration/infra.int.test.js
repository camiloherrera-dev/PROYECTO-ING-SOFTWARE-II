// Integración de la infraestructura con Redis y PostgreSQL reales (npm run test:integration).
// En el CI los levanta el job integration-tests; en local: docker compose up -d redis postgres
const request = require('supertest');
const express = require('express');
const { pool } = require('../../src/db/pool');
const { redis, connectRedis, disconnectRedis } = require('../../src/redis/redisClient');
const { runMigrations } = require('../../src/db/migrate');
const { createHealthRouter } = require('../../src/routes/healthRoutes');

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await connectRedis();
});

afterAll(async () => {
  await Promise.allSettled([disconnectRedis(), pool.end()]);
  jest.restoreAllMocks();
});

test('las migraciones crean las tablas y una segunda corrida no aplica nada', async () => {
  await runMigrations(pool);
  expect(await runMigrations(pool)).toEqual([]);

  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  expect(rows.map((r) => r.tablename)).toEqual(
    expect.arrayContaining(['pedido_items', 'pedidos', 'reglas_descuento', 'schema_migrations']),
  );
});

test('las tres reglas de demostración quedan sembradas y activas', async () => {
  const { rows } = await pool.query('SELECT id, porcentaje FROM reglas_descuento WHERE activa ORDER BY id');
  expect(rows).toEqual([
    { id: 'DESC-CAMISETA-3X', porcentaje: '15.00' },
    { id: 'DESC-CARRITO-300K', porcentaje: '5.00' },
    { id: 'DESC-JEAN-10', porcentaje: '10.00' },
  ]);
});

test('/ready responde ok con Redis y PostgreSQL arriba', async () => {
  const app = express();
  app.use(createHealthRouter({ redis, pool }));
  const res = await request(app).get('/ready');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', redis: 'up', postgres: 'up' });
});
