require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  cartTtlSeconds: Number(process.env.CART_TTL_SECONDS) || 604800, // 7 días
  catalogBaseUrl: process.env.CATALOG_BASE_URL || 'http://localhost:4000/api/catalogo', // incluye el prefijo
  catalogTimeoutMs: Number(process.env.CATALOG_TIMEOUT_MS) || 3000,
  discountTimeoutMs: Number(process.env.DISCOUNT_TIMEOUT_MS) || 200,
  checkoutTtlSeconds: Number(process.env.CHECKOUT_TTL_SECONDS) || 86400, // 24 h en Redis
  checkoutVigenciaSeconds: Number(process.env.CHECKOUT_VIGENCIA_SECONDS) || 900, // 15 min para comprar
  checkoutLockMs: Number(process.env.CHECKOUT_LOCK_MS) || 30000, // CONFIRMANDO caduca a los 30 s
  pedidoTtlSeconds: Number(process.env.PEDIDO_TTL_SECONDS) || 2592000, // 30 días
  // ---- Sprint 4 ----
  databaseUrl: process.env.DATABASE_URL || 'postgres://carrito:carrito_dev@localhost:5432/carrito',
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 5,
  autoMigrate: process.env.AUTO_MIGRATE !== 'false', // con false no se migra al arrancar
  cartInactivityHours: Number(process.env.CART_INACTIVITY_HOURS) || 1, // HU-12
  discountRulesCacheMs: Number(process.env.DISCOUNT_RULES_CACHE_MS) || 60000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 120,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
};

// En producción no se acepta el secreto de pruebas
if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET debe definirse en producción');
}

module.exports = config;
