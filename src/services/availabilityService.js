const cartRepository = require('../repositories/cartRepository');
const catalogClient = require('../clients/catalogClient');
const AppError = require('../errors/AppError');

// HU-09: Verificar disponibilidad de items del carrito contra Catálogo
function createAvailabilityService({ repository = cartRepository, catalog = catalogClient } = {}) {
  async function checkAvailability(userId) {
    const items = await repository.getAllItems(userId);

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(400, 'CARRITO_VACIO', 'El carrito está vacío');
    }

    // Revalidar todos los items en paralelo contra Catálogo
    const products = await Promise.all(items.map((item) => catalog.getProduct(item.productId)));

    const availabilityItems = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const product = products[i];

      // Producto no encontrado o inactivo
      if (!product || !product.activo) {
        availabilityItems.push({
          productId: item.productId,
          cantidad: item.cantidad,
          stock: product && typeof product.stock !== 'undefined' ? product.stock : null,
          estado: 'INACTIVO',
        });
        // No modificamos cantidades ni precios en HU-09
        continue;
      }

      // Detección de cambio de precio
      if (product.precio !== item.precioUnitario) {
        const updatedItem = {
          productId: item.productId,
          nombre: product.nombre,
          precioUnitario: product.precio,
          cantidad: item.cantidad,
        };
        await repository.saveItem(userId, updatedItem);

        // Verificar stock con el nuevo precio/contexto
        const stock = product.stock;
        if (typeof stock === 'number' && stock < item.cantidad) {
          availabilityItems.push({
            productId: item.productId,
            cantidad: item.cantidad,
            stock,
            estado: 'SIN_STOCK',
            precioAnterior: item.precioUnitario,
          });
        } else {
          availabilityItems.push({
            productId: item.productId,
            cantidad: item.cantidad,
            stock: stock === undefined ? null : stock,
            estado: 'PRECIO_CAMBIO',
            precioAnterior: item.precioUnitario,
          });
        }
        continue;
      }

      // Precio igual, verificar stock
      const stock = product.stock;
      if (typeof stock === 'number' && stock < item.cantidad) {
        availabilityItems.push({
          productId: item.productId,
          cantidad: item.cantidad,
          stock,
          estado: 'SIN_STOCK',
        });
        continue;
      }

      // Todo OK
      availabilityItems.push({
        productId: item.productId,
        cantidad: item.cantidad,
        stock: stock === undefined ? null : stock,
        estado: 'OK',
      });
    }

    const disponible = availabilityItems.every((item) => item.estado === 'OK');

    return {
      disponible,
      items: availabilityItems,
    };
  }

  return { checkAvailability };
}

module.exports = { ...createAvailabilityService(), createAvailabilityService };
