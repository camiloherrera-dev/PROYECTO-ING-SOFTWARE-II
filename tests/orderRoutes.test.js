// HU-11: las rutas del historial están conectadas y protegidas por JWT (el servicio va simulado)
jest.mock('../src/services/historyService', () => ({
  listOrders: jest.fn(async () => ({ pedidos: [], total: 0, limit: 10, offset: 0, fuente: 'POSTGRES' })),
  getOrder: jest.fn(async (userId, pedidoId) => ({ pedidoId, userId })),
}));
jest.mock('../src/redis/redisClient', () => ({ redis: { defineCommand: jest.fn() } }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const historyService = require('../src/services/historyService');
const { jwtSecret } = require('../src/config/env');

const auth = (sub = 'usr_1') => ({ Authorization: `Bearer ${jwt.sign({ sub }, jwtSecret)}` });

test('GET /api/carrito/pedidos llega al servicio con el userId del token', async () => {
  const res = await request(app).get('/api/carrito/pedidos').query({ limit: 5, userId: 'otro' }).set(auth());
  expect(res.status).toBe(200);
  expect(historyService.listOrders).toHaveBeenCalledWith('usr_1', expect.objectContaining({ limit: '5' }));
});

test('GET /api/carrito/pedidos/:pedidoId llega al servicio', async () => {
  const res = await request(app).get('/api/carrito/pedidos/ped_1').set(auth('usr_2'));
  expect(res.status).toBe(200);
  expect(historyService.getOrder).toHaveBeenCalledWith('usr_2', 'ped_1');
});

test('sin token responde 401', async () => {
  expect((await request(app).get('/api/carrito/pedidos')).status).toBe(401);
  expect((await request(app).get('/api/carrito/pedidos/ped_1')).status).toBe(401);
});
