const Redis = require('ioredis');
const { redisUrl } = require('../config/env');

// lazyConnect: no se conecta al hacer require (los tests no abren conexiones)
const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
redis.on('error', (e) => console.error('Redis error:', e.message));

async function connectRedis() {
  await redis.connect();
  await redis.ping();
  console.log('Redis connection successful');
}

module.exports = { redis, connectRedis };
