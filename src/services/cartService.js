const cartRepository = require('../repositories/cartRepository');
const catalogClient = require('../clients/catalogClient');
const AppError = require('../errors/AppError');
const { buildCartResponse } = require('./cartTotals');
const { validateQuantity, validateProductId } = require('./validators');
const { cartInactivityHours } = require('../config/env');

// HU-02: conservar addItem (Jeisson) y updateQuantity (Santiago) al integrar.
function createCartService({ repository = cartRepository, catalog = catalogClient,
  buildResponse = buildCartResponse, now = () => Date.now() } = {}) {
  // HU-12: registra la última actividad del cliente. Es de mejor esfuerzo:
  // si falla, la operación del carrito no falla.
  async function touchActividad(userId) {
    try {
      await repository.touchActividad(userId);
    } catch (e) {
      console.warn('No se pudo registrar la actividad del carrito:', e.message);
    }
  }

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
    await touchActividad(userId); // HU-12
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
    await touchActividad(userId); // HU-12
    const items = await repository.getAllItems(userId);
    return buildResponse(userId, items);
  }

  // =================== HU-04 Eliminar producto (Santiago) ===================
  async function removeItem(userId, productId) {
    const removed = await repository.removeItem(userId, productId);
    if (!removed) {
      throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no está en el carrito');
    }
    await touchActividad(userId); // HU-12
    const items = await repository.getAllItems(userId); // [] si era el último
    return buildResponse(userId, items); // totales recalculados sin el producto
  }

  // =================== HU-05 Vaciar carrito (Santiago) ===================
  async function clearCart(userId) {
    await repository.clearCart(userId); // idempotente: vaciar un carrito vacío también es 200
    return buildResponse(userId, []);
  }

  // ===================== HU-12 · Recuperar carrito (Camilo) =====================
  // getCart y la disponibilidad NO registran actividad: son revalidaciones automáticas.
  async function recoverCart(userId) {
    const cart = await getCart(userId); // revalida contra Catálogo (503 si Catálogo cae, igual que GET)
    const hayCarrito = cart.items.length > 0;
    const ultima = await repository.getActividad(userId); // fecha ISO o null
    const expiraEnSegundos = await repository.getTtl(userId); // null si no hay carrito
    const inactividadMs = ultima ? Math.max(0, now() - Date.parse(ultima)) : 0;

    const recuperacion = {
      hayCarrito,
      inactivo: hayCarrito && inactividadMs >= cartInactivityHours * 3600 * 1000,
      ultimaActividad: ultima || null,
      inactividadMinutos: Math.floor(inactividadMs / 60000),
      expiraEnSegundos,
      cambios: {
        preciosCambiados: cart.items
          .filter((i) => i.precioAnterior !== undefined)
          .map(({ productId, nombre, precioAnterior, precioUnitario }) => (
            { productId, nombre, precioAnterior, precioUnitario })),
        noDisponibles: cart.items
          .filter((i) => !i.disponible)
          .map(({ productId, nombre }) => ({ productId, nombre })),
      },
    };

    // La visita cuenta como actividad: el aviso sale una sola vez por periodo de inactividad
    if (hayCarrito) await touchActividad(userId);
    return { ...cart, recuperacion };
  }

  return { getCart, addItem, updateQuantity, removeItem, clearCart, recoverCart };
}

module.exports = { ...createCartService(), createCartService };