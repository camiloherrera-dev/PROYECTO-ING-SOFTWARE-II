const { pool, unico, abrirPostgres, cerrar } = require('./setup');
const { runMigrations } = require('../../src/db/migrate');
const repo = require('../../src/repositories/historyRepository');

beforeAll(abrirPostgres);
afterAll(cerrar);
// Los pedidos de prueba llevan usuarios usr_int_*: se borran (los ítems caen en cascada)
afterEach(() => pool.query("DELETE FROM pedidos WHERE user_id LIKE 'usr_int_%'"));

function pedido(userId, creadoEn) {
  const id = unico('ped');
  return {
    pedidoId: id, checkoutId: `chk_${id}`, userId, estado: 'CONFIRMADO', reservaId: null, creadoEn,
    items: [
      { productId: 'prod_001', nombre: 'Camiseta', cantidad: 3, precioUnitario: 49900, subtotalItem: 149700, descuentoAplicadoItem: 22455, totalItem: 127245 },
      { productId: 'prod_002', nombre: 'Jean', cantidad: 2, precioUnitario: 129900, subtotalItem: 259800, descuentoAplicadoItem: 25980, totalItem: 233820 },
    ],
    subtotal: 409500, descuentoTotal: 66488, total: 343012,
  };
}

test('savePedido guarda el pedido y sus ítems, y es idempotente por checkout', async () => {
  const p = pedido(unico('usr_int'), '2026-11-10T15:00:00.000Z');
  expect(await repo.savePedido(p)).toEqual({ created: true });
  expect(await repo.savePedido(p)).toEqual({ created: false });
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM pedido_items WHERE pedido_id = $1', [p.pedidoId]);
  expect(rows[0].n).toBe(2);
});

test('listPedidos: más reciente primero, paginado y con totales numéricos', async () => {
  const userId = unico('usr_int');
  const antiguo = pedido(userId, '2026-11-08T10:00:00.000Z');
  const medio = pedido(userId, '2026-11-09T10:00:00.000Z');
  const reciente = pedido(userId, '2026-11-10T10:00:00.000Z');
  await Promise.all([antiguo, reciente, medio].map((p) => repo.savePedido(p)));

  const pagina1 = await repo.listPedidos(userId, { limit: 2, offset: 0 });
  expect(pagina1.total).toBe(3);
  expect(pagina1.pedidos.map((p) => p.pedidoId)).toEqual([reciente.pedidoId, medio.pedidoId]);
  expect(pagina1.pedidos[0]).toMatchObject({ unidades: 5, subtotal: 409500, descuentoTotal: 66488, total: 343012 });

  const pagina2 = await repo.listPedidos(userId, { limit: 2, offset: 2 });
  expect(pagina2.pedidos.map((p) => p.pedidoId)).toEqual([antiguo.pedidoId]);
});

test('getPedido devuelve el snapshot solo a su dueño', async () => {
  const userId = unico('usr_int');
  const p = pedido(userId, '2026-11-10T15:00:00.000Z');
  await repo.savePedido(p);
  expect(await repo.getPedido(userId, p.pedidoId)).toMatchObject({ pedidoId: p.pedidoId, total: 343012 });
  expect(await repo.getPedido(unico('usr_int'), p.pedidoId)).toBeNull();
});

test('las migraciones sembraron las reglas de descuento', async () => {
  const { rows } = await pool.query('SELECT id FROM reglas_descuento');
  expect(rows.map((r) => r.id)).toEqual(
    expect.arrayContaining(['DESC-JEAN-10', 'DESC-CAMISETA-3X', 'DESC-CARRITO-300K']));
});

test('las migraciones son idempotentes: correrlas otra vez no aplica nada', async () => {
  expect(await runMigrations(pool)).toEqual([]);
});
