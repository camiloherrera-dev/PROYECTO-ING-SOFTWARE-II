const crypto = require('crypto');
const cartRepository = require('../repositories/cartRepository');
const checkoutRepository = require('../repositories/checkoutRepository');
const catalogClient = require('../clients/catalogClient');
const availabilityService = require('./availabilityService');
const AppError = require('../errors/AppError');
const { buildCartResponse } = require('./cartTotals');
const { checkoutVigenciaSeconds = 900 } = require('../config/env');

function createCheckoutService({
  repository = cartRepository,
  checkouts = checkoutRepository,
  catalog = catalogClient,
  availability = availabilityService,
  buildResponse = buildCartResponse,
  now = () => Date.now(),
} = {}) {
  // =================== HU-08 Crear checkout (Santiago) ===================
  async function createCheckout(userId) {
    const disp = await availability.checkAvailability(userId); // 400 si está vacío, 503 si Catálogo cae
    if (!disp.disponible) {
      throw new AppError(409, 'CARRITO_NO_DISPONIBLE', 'Hay productos que no se pueden comprar', { items: disp.items });
    }

    const items = await repository.getAllItems(userId); // ya con los precios revalidados
    const cart = await buildResponse(userId, items.map((i) => ({ ...i, disponible: true })));

    const checkout = {
      checkoutId: `chk_${crypto.randomUUID()}`,
      estado: 'PENDIENTE',
      expiraEn: new Date(now() + checkoutVigenciaSeconds * 1000).toISOString(),
      ...cart,
    };

    await checkouts.saveCheckout(checkout); // reemplaza al checkout anterior del usuario
    return checkout;
  }

  // =================== HU-10 Confirmar pedido (Camilo) ===================
  // Devuelve { pedido, creado }: creado = false cuando el checkout ya estaba confirmado (idempotencia).
  async function confirmCheckout(userId, checkoutId) {
    const checkout = await checkouts.getCheckout(checkoutId);
    // Un checkout de otro usuario se trata igual que uno inexistente: no se revela que existe
    if (!checkout || checkout.userId !== userId) {
      throw new AppError(404, 'CHECKOUT_NO_ENCONTRADO', 'El checkout no existe');
    }
    if (checkout.estado === 'CONFIRMADO') return pedidoExistente(checkout.pedidoId);

    const vigente = await checkouts.getActiveCheckoutId(userId);
    if (vigente !== checkoutId) {
      throw new AppError(409, 'CHECKOUT_REEMPLAZADO', 'Este resumen fue reemplazado por uno más reciente');
    }
    if (now() > Date.parse(checkout.expiraEn)) {
      throw new AppError(409, 'CHECKOUT_EXPIRADO', 'El resumen de compra venció; vuelve a iniciar el pago');
    }

    // PENDIENTE → CONFIRMANDO de forma atómica (script Lua): solo una petición sigue
    const lock = await checkouts.startConfirmation(checkoutId);
    if (lock.estado === 'CONFIRMADO') return pedidoExistente(lock.pedidoId);
    if (lock.estado === 'CONFIRMANDO') {
      throw new AppError(409, 'CONFIRMACION_EN_CURSO', 'Este pedido se está confirmando; intenta de nuevo en unos segundos');
    }
    if (lock.estado !== 'ADQUIRIDO') {
      throw new AppError(404, 'CHECKOUT_NO_ENCONTRADO', 'El checkout no existe');
    }

    // 1) Descontar stock en Catálogo (todo o nada). Si falla, el checkout vuelve a PENDIENTE.
    let reserva;
    try {
      reserva = await catalog.reserveStock(checkoutId, checkout.items);
    } catch (e) {
      await checkouts.resetConfirmation(checkoutId);
      throw e;
    }

    // 2) Guardar el pedido y marcar CONFIRMADO en una sola transacción.
    // El cliente paga lo que vio: se copia el snapshot sin recalcular.
    const pedido = {
      pedidoId: `ped_${crypto.randomUUID()}`,
      checkoutId,
      userId,
      estado: 'CONFIRMADO',
      creadoEn: new Date(now()).toISOString(),
      reservaId: reserva.reservaId,
      items: checkout.items,
      subtotal: checkout.subtotal,
      descuentoItems: checkout.descuentoItems,
      descuentoCarrito: checkout.descuentoCarrito,
      descuentoTotal: checkout.descuentoTotal,
      total: checkout.total,
      descuentosAplicados: checkout.descuentosAplicados,
    };
    try {
      await checkouts.savePedidoYConfirmar(checkoutId, pedido);
    } catch (e) {
      await catalog.releaseReservation(reserva.reservaId); // nunca lanza
      await checkouts.resetConfirmation(checkoutId).catch(() => {});
      throw new AppError(500, 'ERROR_INTERNO', 'No se pudo guardar el pedido; el stock fue devuelto');
    }

    // 3) Vaciar el carrito. Si falla, el pedido ya existe y no se deshace.
    try {
      await repository.clearCart(userId);
    } catch (e) {
      console.error(`Pedido ${pedido.pedidoId} creado, pero no se pudo vaciar el carrito de ${userId}: ${e.message}`);
    }

    return { pedido, creado: true };
  }

  async function pedidoExistente(pedidoId) {
    const pedido = pedidoId ? await checkouts.getPedido(pedidoId) : null;
    if (!pedido) throw new AppError(404, 'CHECKOUT_NO_ENCONTRADO', 'El pedido de este checkout ya no existe');
    return { pedido, creado: false };
  }

  return { createCheckout, confirmCheckout };
}

module.exports = { ...createCheckoutService(), createCheckoutService };