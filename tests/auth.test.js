const request = require('supertest');
const express = require('express');
const { notFound, errorHandler } = require('../src/middlewares/errorHandler');
const { authJwt } = require('../src/middlewares/authJwt');
const { makeToken } = require('./helpers/token');

function createApp(routeHandler) {
  const app = express();
  app.use(express.json());
  app.use('/api/carrito', authJwt);
  app.get('/api/carrito', routeHandler);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

test('sin token responde 401 con codigo NO_AUTORIZADO', async () => {
  const app = createApp((req, res) => res.json({ userId: req.userId }));
  const res = await request(app).get('/api/carrito');
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ codigo: 'NO_AUTORIZADO', mensaje: expect.stringMatching(/token/i) });
});

test('firma invalida responde 401', async () => {
  const app = createApp((req, res) => res.json({ userId: req.userId }));
  const res = await request(app)
    .get('/api/carrito')
    .set('Authorization', 'Bearer invalid.token.here');
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ codigo: 'NO_AUTORIZADO', mensaje: expect.stringMatching(/inv[aá]lido|inválido/i) });
});

test('token firmado con otro secreto responde 401', async () => {
  const app = createApp((req, res) => res.json({ userId: req.userId }));
  const token = require('jsonwebtoken').sign(
    { sub: 'usr_test' },
    'wrong-secret',
    { expiresIn: '8h', algorithm: 'HS256' }
  );
  const res = await request(app)
    .get('/api/carrito')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ codigo: 'NO_AUTORIZADO', mensaje: expect.stringMatching(/inv[aá]lido|inválido/i) });
});

test('el userId sale del token y se ignora el del query', async () => {
  const app = createApp((req, res) => res.json({ userId: req.userId }));
  const token = makeToken('usr_desde_token');
  const res = await request(app)
    .get('/api/carrito?userId=usr_desde_query')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.userId).toBe('usr_desde_token');
});

test('ruta inexistente responde 404 RUTA_NO_ENCONTRADA', async () => {
  const app = createApp((req, res) => res.json({ userId: req.userId }));
  const res = await request(app).get('/api/no-existe');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'Ruta no encontrada' });
});
