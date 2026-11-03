const cartRepository = require('../repositories/cartRepository');
const catalogClient = require('../clients/catalogClient');
const AppError = require('../errors/AppError');

function createAvailabilityService({
  repository = cartRepository,
  catalog = catalogClient,
} = {}) {
  // HU-09: Validar disponibilidad del carrito (Jose David)
  async function checkAvailability(userId) {
    const items = await repository.getAllItems(userId);
    if (!items || items.length === 0) {
      throw new AppError(400, 'CARRITO_VACIO', 'El carrito está vacío');
    }

    const revalidados = [];
    let allAvailable = true;

    for (const item of items) {
      const prod = await catalog.getProduct(item.productId);
      const stock = prod ? prod.stock : 0;
      const disponible = prod && prod.activo !== false && stock >= item.cantidad;

      if (!disponible) allAvailable = false;

      revalidados.push({
        productId: item.productId,
        cantidad: item.cantidad,
        disponible,
        estado: !prod ? 'NO_EXISTE' : stock < item.cantidad ? 'SIN_STOCK' : 'INACTIVO',
      });
    }

    return {
      disponible: allAvailable,
      items: revalidados,
    };
  }

  return { checkAvailability };
}

module.exports = { ...createAvailabilityService(), createAvailabilityService };