const express = require('express');
const request = require('supertest');
const AppError = require('../src/errors/AppError');
const { errorHandler } = require('../src/middlewares/errorHandler');

const appQueLanza = (err) => {
  const app = express();
  app.get('/x', () => { throw err; });
  app.use(errorHandler);
  return app;
};

test('los detalles de AppError viajan en la respuesta', async () => {
  const res = await request(appQueLanza(new AppError(409, 'STOCK_INSUFICIENTE', 'Sin stock', { items: [{ productId: 'p1' }] }))).get('/x');
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ codigo: 'STOCK_INSUFICIENTE', mensaje: 'Sin stock', items: [{ productId: 'p1' }] });
});

test('los detalles no pueden pisar codigo ni mensaje', async () => {
  const res = await request(appQueLanza(new AppError(409, 'REAL', 'real', { codigo: 'FALSO', mensaje: 'falso' }))).get('/x');
  expect(res.body).toEqual({ codigo: 'REAL', mensaje: 'real' });
});