const express = require('express');
const { redis: redisPorDefecto } = require('../redis/redisClient');
const { pool: poolPorDefecto } = require('../db/pool');

function conTiempo(promesa, ms) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error('tiempo agotado')), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

// /health: el proceso vive (liveness). /ready: puede atender (readiness).
// Redis es obligatorio; si PostgreSQL está caído el servicio sigue, sin histórico, y se informa "degraded".
function createHealthRouter({ redis = redisPorDefecto, pool = poolPorDefecto, timeoutMs = 1500 } = {}) {
  const router = express.Router();

  router.get('/health', (req, res) => res.json({ status: 'ok' }));

  router.get('/ready', async (req, res) => {
    const revisar = async (fn) => {
      try { await conTiempo(fn(), timeoutMs); return 'up'; } catch { return 'down'; }
    };
    const [r, p] = await Promise.all([
      revisar(() => redis.ping()),
      revisar(() => pool.query('SELECT 1')),
    ]);
    const status = r === 'down' ? 'down' : (p === 'down' ? 'degraded' : 'ok');
    res.status(status === 'down' ? 503 : 200).json({ status, redis: r, postgres: p });
  });

  return router;
}

module.exports = { createHealthRouter };
