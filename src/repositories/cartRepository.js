const { redis } = require('../redis/redisClient');
const { cartTtlSeconds } = require('../config/env');

const key = (userId) => `carrito:${userId}`;

async function getItem(userId, productId) {
  const raw = await redis.hget(key(userId), productId);
  return raw ? JSON.parse(raw) : null;
}

async function saveItem(userId, item) {
  const k = key(userId);
  await redis.multi().hset(k, item.productId, JSON.stringify(item)).expire(k, cartTtlSeconds).exec();
}

async function getAllItems(userId) {
  const data = await redis.hgetall(key(userId));
  return Object.values(data || {}).map((raw) => JSON.parse(raw));
}

module.exports = { getItem, saveItem, getAllItems };
