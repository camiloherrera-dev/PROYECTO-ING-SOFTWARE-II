const { redis } = require('../redis/redisClient');
const { cartTtlSeconds } = require('../config/env');

// Modelo: Hash carrito:{userId} → campo = productId, valor = JSON del ítem
// { productId, nombre, precioUnitario, cantidad }. Nunca se guardan disponible ni precioAnterior.
const key = (userId) => `carrito:${userId}`;

// Suma atómica (riesgo 6 del Sprint 1): dos POST simultáneos ya no pierden unidades.
// KEYS[1] = carrito:{userId} · ARGV[1] = productId · ARGV[2] = JSON del ítem
// (cantidad = unidades a sumar) · ARGV[3] = TTL. Devuelve 1 si el producto es nuevo, 0 si ya existía.
redis.defineCommand('cartAddItem', {
  numberOfKeys: 1,
  lua: `
    local nuevo = cjson.decode(ARGV[2])
    local raw = redis.call('HGET', KEYS[1], ARGV[1])
    local creado = 1
    if raw then
      local actual = cjson.decode(raw)
      nuevo['cantidad'] = actual['cantidad'] + nuevo['cantidad']
      creado = 0
    end
    redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(nuevo))
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    return creado
  `,
});

async function getItem(userId, productId) {
  const raw = await redis.hget(key(userId), productId);
  return raw ? JSON.parse(raw) : null;
}

// Guarda (o reemplaza) un ítem y renueva el TTL del carrito completo
async function saveItem(userId, item) {
  const k = key(userId);
  await redis.multi().hset(k, item.productId, JSON.stringify(item)).expire(k, cartTtlSeconds).exec();
}

// HU-01: suma la cantidad si ya existe (precio y nombre se actualizan con los de Catálogo)
async function addItem(userId, item) {
  const creado = await redis.cartAddItem(key(userId), item.productId, JSON.stringify(item), cartTtlSeconds);
  return { created: creado === 1 };
}

// Devuelve [] si el carrito no existe
async function getAllItems(userId) {
  const data = await redis.hgetall(key(userId));
  return Object.values(data || {}).map((raw) => JSON.parse(raw));
}

// HU-04: true si el producto estaba en el carrito. Si era el último, Redis borra la clave solo.
async function removeItem(userId, productId) {
  const k = key(userId);
  const [[, borrados]] = await redis.multi().hdel(k, productId).expire(k, cartTtlSeconds).exec();
  return borrados === 1;
}

// HU-05: elimina la clave completa (idempotente: no falla si no existía)
async function clearCart(userId) {
  await redis.del(key(userId));
}

module.exports = { getItem, saveItem, addItem, getAllItems, removeItem, clearCart };
