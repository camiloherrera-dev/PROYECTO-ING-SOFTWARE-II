const express = require('express');
const request = require('supertest');
const { securityHeaders, createRateLimit } = require('../src/middlewares/security');
const { errorHandler } = require('../src/middlewares/errorHandler');

function appCon(rateLimit) {
  const app = express();
  app.use(securityHeaders);
  app.use((req, res, next) => { req.userId = req.headers['x-user'] || 'usr_1'; next(); });
  app.use(rateLimit);
  app.get('/x', (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

test('agrega las cabeceras de seguridad', async () => {
  const res = await request(appCon(createRateLimit({ max: 5 }))).get('/x');
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-frame-options']).toBe('DENY');
  expect(res.headers['cache-control']).toBe('no-store');
});

test('permite hasta el máximo y responde 429 con Retry-After después', async () => {
  const app = appCon(createRateLimit({ max: 2, windowMs: 60000 }));
  expect((await request(app).get('/x')).status).toBe(200);
  expect((await request(app).get('/x')).status).toBe(200);
  const res = await request(app).get('/x');
  expect(res.status).toBe(429);
  expect(res.body).toEqual({ codigo: 'DEMASIADAS_PETICIONES', mensaje: expect.any(String) });
  expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
});

test('la ventana se reinicia al vencer', async () => {
  let ahora = 1000;
  const app = appCon(createRateLimit({ max: 1, windowMs: 1000, now: () => ahora }));
  expect((await request(app).get('/x')).status).toBe(200);
  expect((await request(app).get('/x')).status).toBe(429);
  ahora += 1001;
  expect((await request(app).get('/x')).status).toBe(200);
});

test('el límite es por usuario', async () => {
  const app = appCon(createRateLimit({ max: 1, windowMs: 60000 }));
  expect((await request(app).get('/x').set('x-user', 'usr_a')).status).toBe(200);
  expect((await request(app).get('/x').set('x-user', 'usr_a')).status).toBe(429);
  expect((await request(app).get('/x').set('x-user', 'usr_b')).status).toBe(200);
});

describe('errores de infraestructura → 503 SERVICIO_NO_DISPONIBLE', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  const appQueLanza = (err) => {
    const app = express();
    app.get('/x', () => { throw err; });
    app.use(errorHandler);
    return app;
  };

  test('ECONNREFUSED (PostgreSQL o Redis caídos)', async () => {
    const err = new Error('connect ECONNREFUSED');
    err.code = 'ECONNREFUSED';
    const res = await request(appQueLanza(err)).get('/x');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: expect.any(String) });
  });

  test('MaxRetriesPerRequestError de ioredis', async () => {
    const err = new Error('Reached the max retries per request limit');
    err.name = 'MaxRetriesPerRequestError';
    expect((await request(appQueLanza(err)).get('/x')).status).toBe(503);
  });

  test('un error cualquiera sigue siendo 500 ERROR_INTERNO sin filtrar el texto interno', async () => {
    const res = await request(appQueLanza(new Error('secreto interno'))).get('/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' });
  });
});