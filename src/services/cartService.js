const cartRepository = require('../repositories/cartRepository');
const catalogClient = require('../clients/catalogClient');
const { buildCartResponse } = require('./cartTotals');

// HU-02: conservar addItem (Jeisson) y updateQuantity (Santiago) al integrar.
function createCartService({ repository = cartRepository, catalog = catalogClient,
  buildResponse = buildCartResponse } = {}) {
  async function getCart(userId) {
    const items = await repository.getAllItems(userId);
    // Revalidar todo antes de escribir: un fallo de Catálogo no debe consumir
    // avisos de cambio de precio de otros ítems en una consulta que termina en 503.
    const products = await Promise.all(items.map((item) => catalog.getProduct(item.productId)));
    const revalidated = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const product = products[i];
      if (!product || !product.activo) {
        revalidated.push({ ...item, disponible: false });
      } else if (product.precio !== item.precioUnitario) {
        const updated = {
          productId: item.productId, nombre: product.nombre,
          precioUnitario: product.precio, cantidad: item.cantidad,
        };
        await repository.saveItem(userId, updated);
        revalidated.push({ ...updated, disponible: true, precioAnterior: item.precioUnitario });
      } else {
        revalidated.push({ ...item, nombre: product.nombre, disponible: true });
      }
    }
    return buildResponse(userId, revalidated);
  }
  return { getCart };
}

module.exports = { ...createCartService(), createCartService };
