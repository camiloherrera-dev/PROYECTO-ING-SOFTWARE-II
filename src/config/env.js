require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  cartTtlSeconds: Number(process.env.CART_TTL_SECONDS) || 604800, // 7 días
  catalogBaseUrl: process.env.CATALOG_BASE_URL || 'http://localhost:4000',
  catalogTimeoutMs: Number(process.env.CATALOG_TIMEOUT_MS) || 3000,
  discountTimeoutMs: Number(process.env.DISCOUNT_TIMEOUT_MS) || 200,
  checkoutTtlSeconds: Number(process.env.CHECKOUT_TTL_SECONDS) || 86400, // 24 h en Redis
  checkoutVigenciaSeconds: Number(process.env.CHECKOUT_VIGENCIA_SECONDS) || 900, // 15 min para comprar
  checkoutLockMs: Number(process.env.CHECKOUT_LOCK_MS) || 30000, // CONFIRMANDO caduca a los 30 s
  pedidoTtlSeconds: Number(process.env.PEDIDO_TTL_SECONDS) || 2592000, // 30 días
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
};
