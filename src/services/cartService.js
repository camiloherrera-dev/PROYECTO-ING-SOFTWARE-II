const cartRepository = require('../repositories/cartRepository');
const catalogClient = require('../clients/catalogClient');
const AppError = require('../errors/AppError');
const { buildCartResponse } = require('./cartTotals');
const { validateQuantity, validateProductId } = require('./validators');

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

  // ===================== HU-01 · Agregar producto (Jeisson) =====================
  async function addItem(userId, productId, cantidad) {
    validateProductId(productId);
    validateQuantity(cantidad);
    // RF-13 / RF-14: producto y precio SIEMPRE salen de Catálogo (nunca del frontend)
    const product = await catalog.getProduct(productId);
    if (!product || !product.activo) {
      throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe o no está activo');
    }
    // Suma atómica en Redis: si ya existía se SUMA la cantidad (200), si es nuevo se crea (201)
    const { created } = await repository.addItem(userId, {
      productId, nombre: product.nombre, precioUnitario: product.precio, cantidad,
    });
    const items = await repository.getAllItems(userId);
    return { created, cart: await buildResponse(userId, items) };
  }

  async function updateQuantity(userId, productId, cantidad) {
    validateQuantity(cantidad);

    const existing = await repository.getItem(userId, productId);
    if (!existing) {
      throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no está en el carrito');
    }

    await repository.saveItem(userId, { ...existing, cantidad });
    const items = await repository.getAllItems(userId);
    return buildResponse(userId, items);
  }

  return { getCart, addItem, updateQuantity };
}

module.exports = { ...createCartService(), createCartService };
