const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCartService } = require('../src/services/cartService');
const AppError = require('../src/errors/AppError');

const item = (id = 'p1', price = 100, quantity = 2) => ({
  productId: id, nombre: id, precioUnitario: price, cantidad: quantity,
});
const product = (price = 100, active = true) => ({ nombre: 'Producto', precio: price, activo: active });
function fixture(items, lookup = async () => product()) {
  const writes = [];
  const reads = [];
  const calls = [];
  const repository = {
    getAllItems: async (userId) => { reads.push(userId); return structuredClone(items); },
    saveItem: async (userId, value) => { writes.push([userId, value]); },
  };
  const catalog = { getProduct: async (id) => { calls.push(id); return lookup(id); } };
  return { ...createCartService({ repository, catalog }), writes, reads, calls };
}

test('carrito vacío tiene totales cero y no consulta Catálogo', async () => {
  const f = fixture([]);
  assert.deepEqual(await f.getCart('u1'), { userId: 'u1', items: [], subtotal: 0, descuentoTotal: 0, total: 0 });
  assert.deepEqual(f.calls, []);
});

test('consulta al usuario solicitado, revalida cada ítem y construye los totales', async () => {
  const f = fixture([item(), item('p2', 100, 3)]);
  const cart = await f.getCart('u2');
  assert.deepEqual(f.reads, ['u2']);
  assert.deepEqual(f.calls, ['p1', 'p2']);
  assert.equal(cart.subtotal, 500);
  assert.equal(cart.total, 500);
  assert.equal(cart.descuentoTotal, 0);
  assert.deepEqual(cart.items[0], { ...item(), nombre: 'Producto', subtotalItem: 200,
    descuentoAplicadoItem: 0, totalItem: 200, disponible: true });
  assert.deepEqual(f.writes, []);
});

for (const unavailable of [null, product(100, false)]) {
  test(`producto ${unavailable ? 'inactivo' : 'eliminado'} se conserva y no suma`, async () => {
    const f = fixture([item(), item('p2')], async (id) => id === 'p1' ? unavailable : product());
    const cart = await f.getCart('u1');
    assert.equal(cart.items.length, 2);
    assert.equal(cart.items[0].disponible, false);
    assert.equal(cart.total, 200);
    assert.deepEqual(f.writes, []);
  });
}

test('precio nuevo se persiste sin campos de presentación y se informa el anterior', async () => {
  const f = fixture([item()], async () => product(150));
  const cart = await f.getCart('u1');
  assert.equal(cart.items[0].precioAnterior, 100);
  assert.equal(cart.items[0].precioUnitario, 150);
  assert.equal(cart.total, 300);
  assert.deepEqual(f.writes, [['u1', { ...item(), nombre: 'Producto', precioUnitario: 150 }]]);
});

test('segunda consulta usa el precio guardado y ya no informa precioAnterior', async () => {
  let stored = item();
  const service = createCartService({ repository: {
    getAllItems: async () => [structuredClone(stored)],
    saveItem: async (_user, updated) => { stored = updated; },
  }, catalog: { getProduct: async () => product(150) } });
  assert.equal((await service.getCart('u1')).items[0].precioAnterior, 100);
  assert.equal(Object.hasOwn((await service.getCart('u1')).items[0], 'precioAnterior'), false);
});

test('fallo de Catálogo propaga 503 sin guardar cambios parciales de precios', async () => {
  const error = new AppError(503, 'CATALOGO_NO_DISPONIBLE', 'caído');
  const f = fixture([item(), item('p2')], async (id) => {
    if (id === 'p2') throw error;
    return product(150);
  });
  await assert.rejects(f.getCart('u1'), error);
  assert.deepEqual(f.writes, []);
});

test('fallo de persistencia no se convierte en éxito ni en error de Catálogo', async () => {
  const error = new Error('Redis no disponible');
  const service = createCartService({ repository: {
    getAllItems: async () => [item()], saveItem: async () => { throw error; },
  }, catalog: { getProduct: async () => product(150) } });
  await assert.rejects(service.getCart('u1'), error);
});

test('repositorio pendiente falla explícitamente hasta integrar Redis', async () => {
  await assert.rejects(require('../src/services/cartService').getCart('u1'), /Repositorio Redis pendiente/);
});
