const express = require('express');
const request = require('supertest');
const { createHealthRouter } = require('../src/routes/healthRoutes');

const appCon = (redis, pool) => {
  const app = express();
  app.use(createHealthRouter({ redis, pool, timeoutMs: 100 }));
  return app;
};
const redisSano = { ping: async () => 'PONG' };
const redisCaido = { ping: async () => { throw new Error('sin conexión'); } };
const redisColgado = { ping: () => new Promise(() => {}) };
const pgSano = { query: async () => ({ rows: [] }) };
const pgCaido = { query: async () => { throw new Error('sin conexión'); } };

test('/health responde ok aunque las bases estén caídas', async () => {
  const res = await request(appCon(redisCaido, pgCaido)).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('/ready con Redis y PostgreSQL arriba → 200 ok', async () => {
  const res = await request(appCon(redisSano, pgSano)).get('/ready');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', redis: 'up', postgres: 'up' });
});

test('/ready con PostgreSQL caído → 200 degraded', async () => {
  const res = await request(appCon(redisSano, pgCaido)).get('/ready');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'degraded', redis: 'up', postgres: 'down' });
});

test('/ready con Redis caído → 503 down', async () => {
  const res = await request(appCon(redisCaido, pgSano)).get('/ready');
  expect(res.status).toBe(503);
  expect(res.body.status).toBe('down');
});

test('un Redis que no responde se considera caído (tiempo agotado)', async () => {
  const res = await request(appCon(redisColgado, pgSano)).get('/ready');
  expect(res.status).toBe(503);
  expect(res.body.redis).toBe('down');
});