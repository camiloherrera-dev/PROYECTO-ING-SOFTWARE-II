const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createCatalogClient } = require('../../src/clients/catalogClient');

const product = { id: 'prod_001', nombre: 'Camiseta', precio: 49900, activo: true };
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const failure = { status: 503, codigo: 'CATALOGO_NO_DISPONIBLE' };

test('mapea precio numérico, id alternativo y producto inactivo', async () => {
  const client = createCatalogClient({ fetchImpl: async () => response(200,
    { _id: 12, nombre: 'Gorra', precio: '35000', activo: false }) });
  assert.deepEqual(await client.getProduct('12'), { productId: '12', nombre: 'Gorra', precio: 35000, activo: false, stock: null });
});

test('codifica el identificador y envía una señal de timeout', async () => {
  const client = createCatalogClient({ baseUrl: 'http://catalogo/api/catalogo/', fetchImpl: async (url, options) => {
    assert.equal(url, 'http://catalogo/api/catalogo/productos/a%2Fb%20%3F');
    assert.ok(options.signal instanceof AbortSignal);
    return response(200, product);
  } });
  assert.equal((await client.getProduct('a/b ?')).precio, 49900);
});

test('404 devuelve null', async () => {
  const client = createCatalogClient({ fetchImpl: async () => response(404, {}) });
  assert.equal(await client.getProduct('missing'), null);
});

for (const status of [400, 401, 429, 500, 503]) {
  test(`HTTP ${status} se traduce a error estándar 503`, async () => {
    const client = createCatalogClient({ fetchImpl: async () => response(status, {}) });
    await assert.rejects(client.getProduct('x'), failure);
  });
}

test('error de red y JSON inválido se traducen a 503', async () => {
  for (const fetchImpl of [async () => { throw new Error('red'); },
    async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError('JSON'); } })]) {
    await assert.rejects(createCatalogClient({ fetchImpl }).getProduct('x'), failure);
  }
});

test('rechaza productos con campos inválidos en vez de producir precios corruptos', async () => {
  for (const body of [null, {}, { ...product, precio: '' }, { ...product, precio: null },
    { ...product, precio: 'NaN' }, { ...product, precio: -1 }, { ...product, activo: 'true' }]) {
    const client = createCatalogClient({ fetchImpl: async () => response(200, body) });
    await assert.rejects(client.getProduct('x'), failure);
  }
});

test('HTTP real contra servidor local y timeout real sin Catálogo externo', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('/slow')) return; // El cliente debe abortar esta petición.
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(product));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await createCatalogClient({ baseUrl }).getProduct('prod_001')).nombre, 'Camiseta');
  await assert.rejects(createCatalogClient({ baseUrl, timeoutMs: 100 }).getProduct('slow'), failure);
});

// ===================== Sprint 3: stock y descuento de stock (Juan David) =====================
test('stock: entero se conserva, ausente es null, inválido es 503', async () => {
  const get = (body) => createCatalogClient({ fetchImpl: async () => response(200, body) }).getProduct('x');
  assert.equal((await get({ ...product, stock: 7 })).stock, 7);
  assert.equal((await get({ ...product, stock: '3' })).stock, 3);
  assert.equal((await get(product)).stock, null);
  for (const stock of [-1, 1.5, 'mucho']) await assert.rejects(get({ ...product, stock }), failure);
});

test('id de MongoDB (_id de 24 caracteres) se toma como productId', async () => {
  const _id = '64f1a2b3c9e77a001f3d8e21';
  const client = createCatalogClient({ fetchImpl: async () => response(200, { ...product, id: undefined, _id }) });
  assert.equal((await client.getProduct(_id)).productId, _id);
});

test('reserveStock: llama a descontar-stock con { referencia, items: [{ id, cantidad }] }', async () => {
  let enviado;
  const client = createCatalogClient({ baseUrl: 'http://catalogo/api/catalogo', fetchImpl: async (url, options) => {
    enviado = { url, method: options.method, body: JSON.parse(options.body) };
    return response(200, { items: [{ id: 'p1', stockRestante: 8 }] });
  } });
  assert.deepEqual(await client.reserveStock('chk_1', [{ productId: 'p1', cantidad: 2 }]), { reservaId: 'chk_1' });
  assert.deepEqual(enviado, { url: 'http://catalogo/api/catalogo/productos/descontar-stock', method: 'POST',
    body: { referencia: 'chk_1', items: [{ id: 'p1', cantidad: 2 }] } });
});

test('reserveStock: 409 de Catálogo (ids en el mensaje) → STOCK_INSUFICIENTE con esos items', async () => {
  const items = [{ productId: '64f1a2b3c9e77a001f3d8e21', cantidad: 5 }, { productId: '64f1a2b3c9e77a001f3d8e22', cantidad: 1 }];
  const client = createCatalogClient({ fetchImpl: async () => response(409, {
    codigo: 'STOCK_INSUFICIENTE', mensaje: 'Stock insuficiente para: 64f1a2b3c9e77a001f3d8e21',
  }) });
  await assert.rejects(client.reserveStock('chk_1', items), (e) => e.status === 409
    && e.codigo === 'STOCK_INSUFICIENTE' && e.detalles.items.length === 1
    && e.detalles.items[0].productId === '64f1a2b3c9e77a001f3d8e21');
});

test('reserveStock: si el 409 trae items en el cuerpo, se usan esos', async () => {
  const client = createCatalogClient({ fetchImpl: async () => response(409, {
    codigo: 'STOCK_INSUFICIENTE', mensaje: 'x', items: [{ id: 'p1', cantidad: 5, stock: 1 }],
  }) });
  await assert.rejects(client.reserveStock('chk_1', [{ productId: 'p1', cantidad: 5 }]),
    (e) => e.detalles.items[0].productId === 'p1' && e.detalles.items[0].stock === 1);
});

test('reserveStock: red o 500 son 503', async () => {
  for (const fetchImpl of [async () => { throw new Error('red'); }, async () => response(500, {})]) {
    await assert.rejects(createCatalogClient({ fetchImpl }).reserveStock('chk_1', []), failure);
  }
});

test('releaseReservation: llama a devolver-stock y nunca lanza', async (t) => {
  t.mock.method(console, 'error', () => {});
  let enviado;
  await createCatalogClient({ baseUrl: 'http://catalogo/api/catalogo', fetchImpl: async (u, o) => {
    enviado = { url: u, body: JSON.parse(o.body) }; return response(204, null);
  } }).releaseReservation('chk_1');
  assert.deepEqual(enviado, { url: 'http://catalogo/api/catalogo/productos/devolver-stock', body: { referencia: 'chk_1' } });
  await createCatalogClient({ fetchImpl: async () => { throw new Error('red'); } }).releaseReservation('chk_1');
  await createCatalogClient({ fetchImpl: async () => response(404, {}) }).releaseReservation('chk_1'); // aún no existe
  assert.equal(console.error.mock.callCount(), 2);
});
