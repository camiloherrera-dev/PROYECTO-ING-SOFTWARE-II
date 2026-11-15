// Tokens de Keycloak (RS256). No necesita Keycloak: se genera un par de llaves de prueba y se simula
// la respuesta de su endpoint de llaves (JWKS).
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

const EMISOR = 'http://localhost:8180/realms/tienda';
process.env.KEYCLOAK_LLAVES = 'http://keycloak:8080/realms/tienda/protocol/openid-connect/certs';
process.env.KEYCLOAK_EMISOR = EMISOR;

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'llave-1', use: 'sig', alg: 'RS256' };

const { notFound, errorHandler } = require('../src/middlewares/errorHandler');
const { authJwt } = require('../src/middlewares/authJwt');
const { makeToken } = require('./helpers/token');

function createApp() {
  const app = express();
  app.use('/api/carrito', authJwt);
  app.get('/api/carrito', (req, res) => res.json({ userId: req.userId }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const tokenKeycloak = (datos = {}, opciones = {}) =>
  jwt.sign({ sub: 'uuid-de-keycloak', ...datos }, privateKey, {
    algorithm: 'RS256', keyid: 'llave-1', issuer: EMISOR, expiresIn: '5m', ...opciones,
  });

beforeAll(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }));
});

test('acepta un token de Keycloak y el usuario sale de sub', async () => {
  const res = await request(createApp()).get('/api/carrito').set('Authorization', `Bearer ${tokenKeycloak()}`);
  expect(res.status).toBe(200);
  expect(res.body.userId).toBe('uuid-de-keycloak');
});

test('sigue aceptando el token de pruebas HS256', async () => {
  const res = await request(createApp()).get('/api/carrito').set('Authorization', `Bearer ${makeToken('usr_dev')}`);
  expect(res.status).toBe(200);
  expect(res.body.userId).toBe('usr_dev');
});

test('rechaza un token de Keycloak de otro emisor', async () => {
  const token = tokenKeycloak({}, { issuer: 'http://otro-keycloak/realms/tienda' });
  const res = await request(createApp()).get('/api/carrito').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
  expect(res.body.codigo).toBe('NO_AUTORIZADO');
});

test('rechaza un token RS256 firmado con otra llave', async () => {
  const otra = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const token = jwt.sign({ sub: 'intruso' }, otra, { algorithm: 'RS256', keyid: 'llave-1', issuer: EMISOR });
  const res = await request(createApp()).get('/api/carrito').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
});

test('rechaza un token de Keycloak vencido', async () => {
  const hace10Minutos = Math.floor(Date.now() / 1000) - 600;
  const token = jwt.sign({ sub: 'uuid-de-keycloak', iat: hace10Minutos, exp: hace10Minutos + 300 }, privateKey, {
    algorithm: 'RS256', keyid: 'llave-1', issuer: EMISOR,
  });
  const res = await request(createApp()).get('/api/carrito').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
});
