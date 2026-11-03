// HU-10 Confirmar pedido (Camilo). Servicio con dependencias inyectadas: no toca Redis ni Catálogo.
const AppError = require('../src/errors/AppError');

// checkoutRepository define el script Lua al cargarse: se simula el cliente Redis
jest.mock('../src/redis/redisClient', () => ({ redis: { defineCommand: jest.fn() } }));

const { createCheckoutService } = require('../src/services/checkoutService');

const AHORA = Date.parse('2026-11-05T15:00:00.000Z');
const snapshot = {
  checkoutId: 'chk_1',
  userId: 'usr_1',
  estado: 'PENDIENTE',
  expiraEn: '2026-11-05T15:15:00.000Z',
  items: [{ productId: 'p1', nombre: 'Teclado', precioUnitario: 100000, cantidad: 2 }],
  subtotal: 200000,
  descuentoItems: 0,
  descuentoCarrito: 20000,
  descuentoTotal: 20000,
  total: 180000,
  descuentosAplicados: [{ codigo: 'CARRITO_10' }],
};

function crear(over = {}) {
  const checkouts = {
    getCheckout: jest.fn().mockResolvedValue({ ...snapshot }),
    getActiveCheckoutId: jest.fn().mockResolvedValue('chk_1'),
    startConfirmation: jest.fn().mockResolvedValue({ estado: 'ADQUIRIDO' }),
    resetConfirmation: jest.fn().mockResolvedValue(),
    savePedidoYConfirmar: jest.fn().mockResolvedValue(),
    getPedido: jest.fn(),
    ...over.checkouts,
  };
  const catalog = {
    reserveStock: jest.fn().mockResolvedValue({ reservaId: 'chk_1' }),
    releaseReservation: jest.fn().mockResolvedValue(),
    ...over.catalog,
  };
  const repository = { clearCart: jest.fn().mockResolvedValue(), ...over.repository };
  const service = createCheckoutService({ checkouts, catalog, repository, now: () => AHORA });
  return { service, checkouts, catalog, repository };
}

async function errorDe(promesa) {
  try { await promesa; } catch (e) { return e; }
  throw new Error('se esperaba un error');
}

test('confirma: descuenta stock, guarda el pedido con el snapshot y vacía el carrito', async () => {
  const { service, checkouts, catalog, repository } = crear();
  const { pedido, creado } = await service.confirmCheckout('usr_1', 'chk_1');

  expect(creado).toBe(true);
  expect(pedido).toMatchObject({
    checkoutId: 'chk_1', userId: 'usr_1', estado: 'CONFIRMADO', reservaId: 'chk_1',
    subtotal: 200000, descuentoTotal: 20000, total: 180000, creadoEn: '2026-11-05T15:00:00.000Z',
  });
  expect(pedido.pedidoId).toMatch(/^ped_/);
  expect(catalog.reserveStock).toHaveBeenCalledWith('chk_1', snapshot.items);
  expect(checkouts.savePedidoYConfirmar).toHaveBeenCalledWith('chk_1', pedido);
  expect(repository.clearCart).toHaveBeenCalledWith('usr_1');
});

test('idempotente: un checkout ya CONFIRMADO devuelve el mismo pedido sin descontar stock', async () => {
  const pedido = { pedidoId: 'ped_1', checkoutId: 'chk_1' };
  const { service, catalog } = crear({ checkouts: {
    getCheckout: jest.fn().mockResolvedValue({ ...snapshot, estado: 'CONFIRMADO', pedidoId: 'ped_1' }),
    getPedido: jest.fn().mockResolvedValue(pedido),
  } });
  await expect(service.confirmCheckout('usr_1', 'chk_1')).resolves.toEqual({ pedido, creado: false });
  expect(catalog.reserveStock).not.toHaveBeenCalled();
});

test('idempotente también si otra petición confirmó entre la lectura y el bloqueo', async () => {
  const pedido = { pedidoId: 'ped_2' };
  const { service, catalog } = crear({ checkouts: {
    startConfirmation: jest.fn().mockResolvedValue({ estado: 'CONFIRMADO', pedidoId: 'ped_2' }),
    getPedido: jest.fn().mockResolvedValue(pedido),
  } });
  await expect(service.confirmCheckout('usr_1', 'chk_1')).resolves.toEqual({ pedido, creado: false });
  expect(catalog.reserveStock).not.toHaveBeenCalled();
});

test.each([
  ['inexistente', null],
  ['de otro usuario', { ...snapshot, userId: 'usr_2' }],
])('404 CHECKOUT_NO_ENCONTRADO si el checkout es %s', async (_, valor) => {
  const { service } = crear({ checkouts: { getCheckout: jest.fn().mockResolvedValue(valor) } });
  const e = await errorDe(service.confirmCheckout('usr_1', 'chk_1'));
  expect(e).toBeInstanceOf(AppError);
  expect([e.status, e.codigo]).toEqual([404, 'CHECKOUT_NO_ENCONTRADO']);
});

test('409 CHECKOUT_REEMPLAZADO si el usuario creó un checkout más nuevo', async () => {
  const { service, checkouts } = crear({ checkouts: { getActiveCheckoutId: jest.fn().mockResolvedValue('chk_2') } });
  const e = await errorDe(service.confirmCheckout('usr_1', 'chk_1'));
  expect([e.status, e.codigo]).toEqual([409, 'CHECKOUT_REEMPLAZADO']);
  expect(checkouts.startConfirmation).not.toHaveBeenCalled();
});

test('409 CHECKOUT_EXPIRADO pasados los 15 minutos', async () => {
  const { service } = crear({ checkouts: {
    getCheckout: jest.fn().mockResolvedValue({ ...snapshot, expiraEn: '2026-11-05T14:59:59.000Z' }),
  } });
  const e = await errorDe(service.confirmCheckout('usr_1', 'chk_1'));
  expect([e.status, e.codigo]).toEqual([409, 'CHECKOUT_EXPIRADO']);
});

test('409 CONFIRMACION_EN_CURSO si otra petición tiene el bloqueo', async () => {
  const { service, catalog } = crear({ checkouts: {
    startConfirmation: jest.fn().mockResolvedValue({ estado: 'CONFIRMANDO' }),
  } });
  const e = await errorDe(service.confirmCheckout('usr_1', 'chk_1'));
  expect([e.status, e.codigo]).toEqual([409, 'CONFIRMACION_EN_CURSO']);
  expect(catalog.reserveStock).not.toHaveBeenCalled();
});

test('STOCK_INSUFICIENTE: el checkout vuelve a PENDIENTE y no se guarda pedido', async () => {
  const sinStock = new AppError(409, 'STOCK_INSUFICIENTE', 'No hay stock', { items: [{ productId: 'p1' }] });
  const { service, checkouts, repository } = crear({ catalog: { reserveStock: jest.fn().mockRejectedValue(sinStock) } });
  const e = await errorDe(service.confirmCheckout('usr_1', 'chk_1'));
  expect(e).toBe(sinStock);
  expect(checkouts.resetConfirmation).toHaveBeenCalledWith('chk_1');
  expect(checkouts.savePedidoYConfirmar).not.toHaveBeenCalled();
  expect(repository.clearCart).not.toHaveBeenCalled();
});

test('si guardar el pedido falla, se devuelve el stock y el checkout vuelve a PENDIENTE', async () => {
  const { service, checkouts, catalog, repository } = crear({ checkouts: {
    savePedidoYConfirmar: jest.fn().mockRejectedValue(new Error('Redis caído')),
  } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const e = await errorDe(service.confirmCheckout('usr_1', 'chk_1'));
  expect([e.status, e.codigo]).toEqual([500, 'ERROR_INTERNO']);
  expect(catalog.releaseReservation).toHaveBeenCalledWith('chk_1');
  expect(checkouts.resetConfirmation).toHaveBeenCalledWith('chk_1');
  expect(repository.clearCart).not.toHaveBeenCalled();
});

test('un fallo al vaciar el carrito no deshace el pedido', async () => {
  const { service, catalog } = crear({ repository: { clearCart: jest.fn().mockRejectedValue(new Error('x')) } });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { creado } = await service.confirmCheckout('usr_1', 'chk_1');
  expect(creado).toBe(true);
  expect(catalog.releaseReservation).not.toHaveBeenCalled();
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

// ---------- execOrThrow (deuda D2: exec() de ioredis no lanza dentro de MULTI) ----------
describe('execOrThrow', () => {
  const { execOrThrow } = require('../src/repositories/checkoutRepository');

  test('devuelve los resultados si todos los comandos salieron bien', async () => {
    await expect(execOrThrow({ exec: async () => [[null, 'OK'], [null, 1]] })).resolves.toEqual([[null, 'OK'], [null, 1]]);
  });
  test('lanza el error de un comando fallido', async () => {
    const err = new Error('WRONGTYPE');
    await expect(execOrThrow({ exec: async () => [[null, 'OK'], [err, null]] })).rejects.toBe(err);
  });
  test('lanza si la transacción fue abortada (exec devuelve null)', async () => {
    await expect(execOrThrow({ exec: async () => null })).rejects.toThrow('abortada');
  });
});
