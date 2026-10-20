require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  cartTtlSeconds: Number(process.env.CART_TTL_SECONDS) || 604800, // 7 días
  catalogBaseUrl: process.env.CATALOG_BASE_URL || 'http://localhost:4000',
  catalogTimeoutMs: Number(process.env.CATALOG_TIMEOUT_MS) || 3000,
  discountTimeoutMs: Number(process.env.DISCOUNT_TIMEOUT_MS) || 200,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
};
