const Redis = require('ioredis');
const { redisUrl } = require('../config/env');

// lazyConnect: no se conecta al hacer require (los tests no abren conexiones).
// retryStrategy: si Redis se cae, reintenta con espera creciente hasta 2 s.
const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  connectTimeout: 5000,
  retryStrategy: (veces) => Math.min(veces * 200, 2000),
});
redis.on('error', (e) => console.error('Redis error:', e.message));

async function connectRedis() {
  await redis.connect();
  await redis.ping();
  console.log('Redis connection successful');
}

async function disconnectRedis() {
  try { await redis.quit(); } catch { redis.disconnect(); }
}

module.exports = { redis, connectRedis, disconnectRedis };
