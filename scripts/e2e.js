#!/usr/bin/env node
// Prueba E2E por Kong (Juan David). Uso:
//   npm run e2e                 → flujo del Sprint 2 (carrito + descuentos + 401)
//   npm run e2e -- --pedido     → además disponibilidad → checkout → confirmar (Sprint 3)
//   npm run e2e -- --historial  → además historial de pedidos, recuperar carrito y /ready (Sprint 4)
// Variables: BASE_URL (Kong, por defecto http://localhost:8000), CATALOG_URL (mock, http://localhost:4000)
// y API_URL (servicio directo para /ready, http://localhost:3000). Antes de empezar reinicia el mock de Catálogo.
// Termina con código 1 si algo falla, para poder sumarlo al CI.
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config/env');

const BASE = (process.env.BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const CATALOG = (process.env.CATALOG_URL || 'http://localhost:4000').replace(/\/+$/, '');
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const conPedido = process.argv.includes('--pedido');
const conHistorial = process.argv.includes('--historial');
const userId = `usr_e2e_${Date.now()}`;
const token = jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });

let fallos = 0;
function check(nombre, ok, detalle = '') {
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok || !detalle ? '' : ` → ${detalle}`}`);
  if (!ok) fallos += 1;
}

async function api(method, path, body, { auth = true } = {}) {
  const res = await fetch(`${BASE}/api/carrito${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Deja el mock de Catálogo como al arrancar (productos, stock y descuentos de stock)
async function reiniciarCatalogo() {
  const res = await fetch(`${CATALOG}/__test/reset`, { method: 'POST' });
  check('Mock de Catálogo reiniciado', res.status === 204, res.status);
}

const stockDe = async (id) => (await (await fetch(`${CATALOG}/api/catalogo/productos/${id}`)).json()).stock;

async function sprint2() {
  let r = await api('GET', '', null, { auth: false });
  check('Sin token → 401 NO_AUTORIZADO', r.status === 401 && r.body?.codigo === 'NO_AUTORIZADO', r.status);

  r = await api('DELETE', '');
  check('Vaciar carrito nuevo → 200 (idempotente)', r.status === 200 && r.body.items.length === 0, r.status);

  r = await api('POST', '/items', { productId: 'prod_001', cantidad: 2 });
  check('POST 2 camisetas → 201', r.status === 201, r.status);
  r = await api('POST', '/items', { productId: 'prod_001', cantidad: 1 });
  check('POST 1 camiseta más → 200 y suma 3', r.status === 200 && r.body.items[0].cantidad === 3, JSON.stringify(r.body?.items));
  r = await api('POST', '/items', { productId: 'prod_002', cantidad: 2 });
  check('POST 2 jeans → 201', r.status === 201, r.status);
  r = await api('POST', '/items', { productId: 'prod_003', cantidad: 1 });
  check('POST producto inactivo → 404', r.status === 404, r.status);

  r = await api('GET', '');
  check('GET → total 343.012 con descuentos (22.455 + 25.980 + 18.053)',
    r.status === 200 && r.body.total === 343012 && r.body.descuentoTotal === 66488, `total=${r.body?.total}`);

  r = await api('PUT', '/items/prod_002', { cantidad: 1 });
  check('PUT jeans a 1 → 200 y reemplaza', r.status === 200 && r.body.items.find((i) => i.productId === 'prod_002').cantidad === 1, r.status);
  r = await api('PUT', '/items/prod_002', { cantidad: 0 });
  check('PUT cantidad 0 → 400', r.status === 400, r.status);

  r = await api('DELETE', '/items/prod_002');
  check('DELETE jeans → 200 sin el producto', r.status === 200 && !r.body.items.some((i) => i.productId === 'prod_002'), r.status);
  r = await api('DELETE', '/items/prod_002');
  check('DELETE otra vez → 404', r.status === 404, r.status);

  r = await api('DELETE', '');
  check('Vaciar → 200 con total 0', r.status === 200 && r.body.total === 0, r.status);
}

async function sprint3() {
  await api('POST', '/items', { productId: 'prod_001', cantidad: 3 });
  await api('POST', '/items', { productId: 'prod_002', cantidad: 2 });
  const stockAntes = { prod_001: await stockDe('prod_001'), prod_002: await stockDe('prod_002') };

  let r = await api('GET', '/disponibilidad');
  check('Disponibilidad → 200 todo OK', r.status === 200 && r.body.disponible === true, JSON.stringify(r.body));

  r = await api('POST', '/checkout');
  check('Checkout → 201 con checkoutId y total 343.012', r.status === 201 && r.body.total === 343012 && /^chk_/.test(r.body.checkoutId), r.status);
  const { checkoutId } = r.body || {};

  r = await api('POST', `/checkout/${checkoutId}/confirmar`);
  check('Confirmar → 201 pedido CONFIRMADO', r.status === 201 && r.body.estado === 'CONFIRMADO', r.status);
  const { pedidoId } = r.body || {};

  r = await api('POST', `/checkout/${checkoutId}/confirmar`);
  check('Confirmar otra vez → 200 mismo pedido', r.status === 200 && r.body.pedidoId === pedidoId, r.status);

  r = await api('GET', '');
  check('El carrito quedó vacío', r.status === 200 && r.body.items.length === 0, r.body?.items?.length);

  check('Stock del mock bajó 3 camisetas y 2 jeans (una sola vez)',
    await stockDe('prod_001') === stockAntes.prod_001 - 3 && await stockDe('prod_002') === stockAntes.prod_002 - 2);

  r = await api('POST', '/checkout/chk_no_existe/confirmar');
  check('Confirmar checkout inexistente → 404', r.status === 404, r.status);
}

async function sprint4() {
  // Después de sprint3(): el pedido recién confirmado debe estar en el historial
  let r = await api('GET', '/pedidos');
  check('Historial → 200 con el pedido confirmado',
    r.status === 200 && r.body.total >= 1 && Boolean(r.body.pedidos?.[0]?.pedidoId), JSON.stringify(r.body));
  const pedidoId = r.body?.pedidos?.[0]?.pedidoId;

  r = await api('GET', `/pedidos/${pedidoId}`);
  check('Detalle del pedido → 200 con 2 ítems y total 343.012',
    r.status === 200 && r.body.total === 343012 && r.body.items?.length === 2, r.status);
  r = await api('GET', '/pedidos/ped_no_existe');
  check('Pedido inexistente → 404', r.status === 404 && r.body?.codigo === 'PEDIDO_NO_ENCONTRADO', r.status);
  r = await api('GET', '/pedidos?limit=0');
  check('limit=0 → 400', r.status === 400 && r.body?.codigo === 'VALIDACION_FALLIDA', r.status);
  r = await api('GET', '/pedidos', null, { auth: false });
  check('Historial sin token → 401', r.status === 401, r.status);

  await api('POST', '/items', { productId: 'prod_001', cantidad: 1 });
  r = await api('GET', '/recuperar');
  check('Recuperar → 200 con recuperacion.hayCarrito', r.status === 200 && r.body.recuperacion?.hayCarrito === true,
    JSON.stringify(r.body?.recuperacion));
  r = await api('GET', '/recuperar', null, { auth: false });
  check('Recuperar sin token → 401', r.status === 401, r.status);

  const ready = await fetch(`${API_URL}/ready`).then((x) => x.json()).catch(() => null);
  check('/ready → Redis arriba', ready?.redis === 'up', JSON.stringify(ready));
  await api('DELETE', '');
}

(async () => {
  console.log(`E2E contra ${BASE} (usuario ${userId})\n`);
  try {
    await reiniciarCatalogo();
    await sprint2();
    if (conPedido || conHistorial) await sprint3();
    if (conHistorial) await sprint4();
  } catch (e) {
    check('El servicio responde', false, e.message);
  }
  console.log(fallos ? `\n${fallos} verificación(es) fallaron` : '\nTodo en verde');
  process.exit(fallos ? 1 : 0);
})();
