const { redis, unico, abrirRedis, cerrar } = require('./setup');
const repo = require('../../src/repositories/checkoutRepository');

beforeAll(abrirRedis);
afterAll(cerrar);

const snapshot = (userId, checkoutId) => ({
  checkoutId, userId, items: [], descuentosAplicados: [], total: 0,
});

test('el snapshot sale igual a como entró, con los arreglos vacíos', async () => {
  const userId = unico('usr');
  const checkoutId = unico('chk');
  await repo.saveCheckout(snapshot(userId, checkoutId));
  const leido = await repo.getCheckout(checkoutId);
  expect(leido).toMatchObject({ checkoutId, estado: 'PENDIENTE' });
  expect(Array.isArray(leido.descuentosAplicados)).toBe(true);
  expect(leido.descuentosAplicados).toEqual([]);
});

test('un checkout nuevo reemplaza al vigente del usuario', async () => {
  const userId = unico('usr');
  const a = unico('chk');
  const b = unico('chk');
  await repo.saveCheckout(snapshot(userId, a));
  await repo.saveCheckout(snapshot(userId, b));
  expect(await repo.getActiveCheckoutId(userId)).toBe(b);
});

test('cinco confirmaciones simultáneas: solo una recibe ADQUIRIDO', async () => {
  const checkoutId = unico('chk');
  await repo.saveCheckout(snapshot(unico('usr'), checkoutId));
  const r = await Promise.all([1, 2, 3, 4, 5].map(() => repo.startConfirmation(checkoutId)));
  expect(r.filter((x) => x.estado === 'ADQUIRIDO')).toHaveLength(1);
  expect(r.filter((x) => x.estado === 'CONFIRMANDO')).toHaveLength(4);
});

test('un CONFIRMANDO abandonado (más de 30 s) se puede retomar', async () => {
  const checkoutId = unico('chk');
  await repo.saveCheckout(snapshot(unico('usr'), checkoutId));
  await redis.hset(`checkout:${checkoutId}`, 'estado', 'CONFIRMANDO', 'confirmandoDesde', String(Date.now() - 60000));
  expect((await repo.startConfirmation(checkoutId)).estado).toBe('ADQUIRIDO');
});

test('savePedidoYConfirmar deja el checkout CONFIRMADO y el pedido en la lista del usuario', async () => {
  const userId = unico('usr');
  const checkoutId = unico('chk');
  await repo.saveCheckout(snapshot(userId, checkoutId));
  const pedido = { pedidoId: unico('ped'), checkoutId, userId, estado: 'CONFIRMADO', items: [], total: 0 };
  await repo.savePedidoYConfirmar(checkoutId, pedido);
  expect((await repo.getCheckout(checkoutId)).estado).toBe('CONFIRMADO');
  expect(await repo.getPedido(pedido.pedidoId)).toMatchObject({ pedidoId: pedido.pedidoId });
  const lista = await repo.listPedidosRecientes(userId, 10, 0);
  expect(lista.total).toBe(1);
  expect(lista.pedidos[0].pedidoId).toBe(pedido.pedidoId);
});
