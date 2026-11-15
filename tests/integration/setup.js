// Ayudantes de las pruebas de integración (Redis y PostgreSQL reales)
const { redis, connectRedis, disconnectRedis } = require('../../src/redis/redisClient');
const { pool, connectDb } = require('../../src/db/pool');
const { runMigrations } = require('../../src/db/migrate');

const unico = (prefijo) => `${prefijo}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function abrirRedis() {
  await connectRedis();
}

async function abrirPostgres() {
  await connectDb();
  await runMigrations(pool);
}

async function cerrar() {
  await Promise.allSettled([disconnectRedis(), pool.end()]);
}

module.exports = { redis, pool, unico, abrirRedis, abrirPostgres, cerrar };
