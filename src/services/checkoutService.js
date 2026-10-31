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

  return { createCheckout };
}

module.exports = { ...createCheckoutService(), createCheckoutService };