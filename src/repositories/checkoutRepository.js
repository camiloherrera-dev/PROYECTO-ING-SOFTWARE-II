const { redis } = require('../redis/redisClient');
const { checkoutTtlSeconds, checkoutLockMs, pedidoTtlSeconds } = require('../config/env');

// Hash checkout:{id} → data (JSON del snapshot, no cambia), estado, userId, pedidoId, confirmandoDesde
const kCheckout = (id) => `checkout:${id}`;
const kActivo = (userId) => `checkout-usuario:${userId}`; // checkoutId del checkout vigente
const kPedido = (id) => `pedido:${id}`;
const kPedidos = (userId) => `pedidos-usuario:${userId}`;

// PENDIENTE → CONFIRMANDO en una sola operación. Un CONFIRMANDO de más de ARGV[2] ms se
// considera abandonado (el proceso se cayó) y se puede volver a tomar.
// KEYS[1] = checkout:{id} · ARGV[1] = ahora (ms) · ARGV[2] = duración del bloqueo (ms)
redis.defineCommand('checkoutConfirm', {
  numberOfKeys: 1,
  lua: `
    local estado = redis.call('HGET', KEYS[1], 'estado')
    if not estado then return {'NO_EXISTE', ''} end
    local ahora = tonumber(ARGV[1])
    if estado == 'CONFIRMANDO' then
      local desde = tonumber(redis.call('HGET', KEYS[1], 'confirmandoDesde') or '0')
      if ahora - desde > tonumber(ARGV[2]) then estado = 'PENDIENTE' end
    end
    if estado == 'PENDIENTE' then
      redis.call('HSET', KEYS[1], 'estado', 'CONFIRMANDO', 'confirmandoDesde', ARGV[1])
      return {'ADQUIRIDO', ''}
    end
    return {estado, redis.call('HGET', KEYS[1], 'pedidoId') or ''}
  `,
});

// exec() de ioredis NO lanza si un comando de la MULTI falla: devuelve [[err, res], ...].
// Esta función convierte cualquiera de esos errores (o una transacción abortada) en excepción.
async function execOrThrow(multi) {
  const results = await multi.exec();
  if (results === null) throw new Error('Transacción de Redis abortada');
  const fallo = (results || []).find(([err]) => err);
  if (fallo) throw fallo[0];
  return results;
}

async function saveCheckout(checkout) {
  const k = kCheckout(checkout.checkoutId);
  await execOrThrow(redis.multi()
    .del(k)
    .hset(k, 'data', JSON.stringify(checkout), 'estado', 'PENDIENTE', 'userId', checkout.userId)
    .expire(k, checkoutTtlSeconds)
    // El puntero define cuál es el checkout vigente: uno nuevo reemplaza al anterior
    .set(kActivo(checkout.userId), checkout.checkoutId, 'EX', checkoutTtlSeconds));
}

async function getCheckout(checkoutId) {
  const h = await redis.hgetall(kCheckout(checkoutId));
  if (!h || !h.data) return null;
  return { ...JSON.parse(h.data), estado: h.estado, pedidoId: h.pedidoId || undefined };
}

async function getActiveCheckoutId(userId) {
  return redis.get(kActivo(userId));
}

async function startConfirmation(checkoutId) {
  const [estado, pedidoId] = await redis.checkoutConfirm(kCheckout(checkoutId), Date.now(), checkoutLockMs);
  return { estado, pedidoId: pedidoId || undefined };
}

async function resetConfirmation(checkoutId) {
  await redis.hset(kCheckout(checkoutId), 'estado', 'PENDIENTE');
}

// Guarda el pedido Y marca el checkout CONFIRMADO en la misma transacción (MULTI):
// nunca queda un pedido guardado con el checkout sin confirmar.
async function savePedidoYConfirmar(checkoutId, pedido) {
  await execOrThrow(redis.multi()
    .set(kPedido(pedido.pedidoId), JSON.stringify(pedido), 'EX', pedidoTtlSeconds)
    .lpush(kPedidos(pedido.userId), pedido.pedidoId)
    .expire(kPedidos(pedido.userId), pedidoTtlSeconds)
    .hset(kCheckout(checkoutId), 'estado', 'CONFIRMADO', 'pedidoId', pedido.pedidoId));
}

async function getPedido(pedidoId) {
  const raw = await redis.get(kPedido(pedidoId));
  return raw ? JSON.parse(raw) : null;
}

// Respaldo del historial: pedidos recientes del usuario en Redis (30 días), el más reciente primero
async function listPedidosRecientes(userId, limit, offset) {
  const total = await redis.llen(kPedidos(userId));
  const ids = await redis.lrange(kPedidos(userId), offset, offset + limit - 1);
  if (ids.length === 0) return { total, pedidos: [] };
  const crudos = await redis.mget(ids.map(kPedido));
  // Un pedido cuyo TTL ya venció llega como null: se omite
  return { total, pedidos: crudos.filter(Boolean).map((raw) => JSON.parse(raw)) };
}

module.exports = {
  saveCheckout, getCheckout, getActiveCheckoutId, startConfirmation,
  resetConfirmation, savePedidoYConfirmar, getPedido, execOrThrow,
  listPedidosRecientes,
};