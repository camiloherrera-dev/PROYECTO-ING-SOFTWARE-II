const { redis, unico, abrirRedis, cerrar } = require('./setup');
const repo = require('../../src/repositories/cartRepository');

beforeAll(abrirRedis);
afterAll(cerrar);

const item = (productId, cantidad = 1) => ({ productId, nombre: productId, precioUnitario: 1000, cantidad });

test('20 agregados simultáneos suman 20 (script atómico) y solo uno crea el producto', async () => {
  const userId = unico('usr');
  const resultados = await Promise.all(Array.from({ length: 20 }, () => repo.addItem(userId, item('prod_001'))));
  expect(resultados.filter((r) => r.created)).toHaveLength(1);
  expect((await repo.getItem(userId, 'prod_001')).cantidad).toBe(20);
  await repo.clearCart(userId);
});

test('el carrito queda con TTL cercano a 7 días', async () => {
  const userId = unico('usr');
  await repo.addItem(userId, item('prod_001'));
  const ttl = await redis.ttl(`carrito:${userId}`);
  expect(ttl).toBeGreaterThan(604000);
  expect(ttl).toBeLessThanOrEqual(604800);
  await repo.clearCart(userId);
});

test('removeItem: true si existía, false si no; al quitar el último desaparece la clave', async () => {
  const userId = unico('usr');
  await repo.addItem(userId, item('prod_001'));
  expect(await repo.removeItem(userId, 'prod_999')).toBe(false);
  expect(await repo.removeItem(userId, 'prod_001')).toBe(true);
  expect(await redis.exists(`carrito:${userId}`)).toBe(0);
});

test('actividad: touchActividad, getActividad y getTtl', async () => {
  const userId = unico('usr');
  expect(await repo.getActividad(userId)).toBeNull();
  expect(await repo.getTtl(userId)).toBeNull();
  await repo.addItem(userId, item('prod_001'));
  await repo.touchActividad(userId);
  const ultima = await repo.getActividad(userId);
  expect(Date.now() - Date.parse(ultima)).toBeLessThan(5000);
  expect(await repo.getTtl(userId)).toBeGreaterThan(604000);
  await repo.clearCart(userId);
});

test('clearCart borra el carrito y el registro de actividad, y es idempotente', async () => {
  const userId = unico('usr');
  await repo.addItem(userId, item('prod_001'));
  await repo.touchActividad(userId);
  await repo.clearCart(userId);
  await repo.clearCart(userId);
  expect(await redis.exists(`carrito:${userId}`)).toBe(0);
  expect(await redis.exists(`carrito-actividad:${userId}`)).toBe(0);
});
