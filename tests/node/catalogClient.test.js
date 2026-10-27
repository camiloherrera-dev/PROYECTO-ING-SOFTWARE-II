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
  const client = createCatalogClient({ baseUrl: 'http://catalogo/', fetchImpl: async (url, options) => {
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

// ===================== Sprint 3: stock y reservas (Juan David) =====================
test('stock: entero se conserva, ausente es null, inválido es 503', async () => {
  const get = (body) => createCatalogClient({ fetchImpl: async () => response(200, body) }).getProduct('x');
  assert.equal((await get({ ...product, stock: 7 })).stock, 7);
  assert.equal((await get({ ...product, stock: '3' })).stock, 3);
  assert.equal((await get(product)).stock, null);
  for (const stock of [-1, 1.5, 'mucho']) await assert.rejects(get({ ...product, stock }), failure);
});

test('reserveStock: 201 devuelve reservaId y envía referencia e items', async () => {
  let enviado;
  const client = createCatalogClient({ baseUrl: 'http://catalogo', fetchImpl: async (url, options) => {
    enviado = { url, method: options.method, body: JSON.parse(options.body) };
    return response(201, { reservaId: 'res_1' });
  } });
  assert.deepEqual(await client.reserveStock('chk_1', [{ productId: 'p1', cantidad: 2 }]), { reservaId: 'res_1' });
  assert.deepEqual(enviado, { url: 'http://catalogo/api/catalogo/reservas', method: 'POST',
    body: { referencia: 'chk_1', items: [{ productId: 'p1', cantidad: 2 }] } });
});

test('reserveStock: 409 se traduce a STOCK_INSUFICIENTE con los items', async () => {
  const items = [{ productId: 'p1', cantidad: 5 }];
  const client = createCatalogClient({ fetchImpl: async () => response(409, { codigo: 'STOCK_INSUFICIENTE', items }) });
  await assert.rejects(client.reserveStock('chk_1', items),
    (e) => e.status === 409 && e.codigo === 'STOCK_INSUFICIENTE' && e.detalles.items.length === 1);
});

test('reserveStock: red, 500 o respuesta sin reservaId son 503', async () => {
  for (const fetchImpl of [async () => { throw new Error('red'); }, async () => response(500, {}),
    async () => response(201, {})]) {
    await assert.rejects(createCatalogClient({ fetchImpl }).reserveStock('chk_1', []), failure);
  }
});

test('releaseReservation: nunca lanza, aunque Catálogo falle', async (t) => {
  t.mock.method(console, 'error', () => {});
  let url;
  await createCatalogClient({ baseUrl: 'http://catalogo', fetchImpl: async (u) => { url = u; return response(204, null); } })
    .releaseReservation('res_1');
  assert.equal(url, 'http://catalogo/api/catalogo/reservas/res_1');
  await createCatalogClient({ fetchImpl: async () => { throw new Error('red'); } }).releaseReservation('res_1');
  await createCatalogClient({ fetchImpl: async () => response(500, {}) }).releaseReservation('res_1');
});
