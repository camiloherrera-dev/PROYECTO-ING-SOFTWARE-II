const { catalogBaseUrl, catalogTimeoutMs } = require('../config/env');
const AppError = require('../errors/AppError');

const unavailable = () => new AppError(
  503, 'CATALOGO_NO_DISPONIBLE', 'No fue posible consultar el servicio de Catálogo',
);

// stock es opcional: entero >= 0, o null si Catálogo no lo envía (no rompe GET ni POST).
function mapStock(raw) {
  if (raw === undefined || raw === null) return null;
  const stock = Number(raw);
  if (!Number.isInteger(stock) || stock < 0) throw unavailable();
  return stock;
}

// Adaptar solo aquí los nombres de campos cuando se confirme el contrato real.
function mapProduct(product) {
  const id = product?.id ?? product?._id;
  const rawPrice = product?.precio;
  const price = Number(rawPrice);
  if (!['string', 'number'].includes(typeof id) || !String(id).trim()
    || typeof product.nombre !== 'string' || !product.nombre.trim()
    || !['string', 'number'].includes(typeof rawPrice) || String(rawPrice).trim() === ''
    || !Number.isFinite(price) || price < 0 || typeof product.activo !== 'boolean') {
    throw unavailable();
  }
  return {
    productId: String(id), nombre: product.nombre, precio: price, activo: product.activo,
    stock: mapStock(product.stock),
  };
}

// Inyección opcional para pruebas; los consumidores usan getProduct, reserveStock y releaseReservation.
function createCatalogClient({ baseUrl = catalogBaseUrl, timeoutMs = catalogTimeoutMs,
  fetchImpl = globalThis.fetch } = {}) {
  const url = (path) => `${baseUrl.replace(/\/+$/, '')}${path}`;

  return {
    async getProduct(productId) {
      try {
        const response = await fetchImpl(
          url(`/api/catalogo/productos/${encodeURIComponent(productId)}`),
          { signal: AbortSignal.timeout(timeoutMs) },
        );
        if (response.status === 404) return null;
        if (!response.ok) throw unavailable();
        return mapProduct(await response.json());
      } catch {
        // Incluye timeout, red, HTTP inesperado y JSON/esquema inválido.
        throw unavailable();
      }
    },

    // HU-10: reserva el stock del pedido. Idempotente por referencia (el checkoutId).
    async reserveStock(referencia, items) {
      let response;
      let body;
      try {
        response = await fetchImpl(url('/api/catalogo/reservas'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referencia, items }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        body = await response.json().catch(() => null);
      } catch {
        throw unavailable();
      }
      if (response.status === 409) {
        throw new AppError(409, 'STOCK_INSUFICIENTE', 'No hay stock suficiente para algunos productos',
          { items: Array.isArray(body?.items) ? body.items : [] });
      }
      if (!response.ok || typeof body?.reservaId !== 'string' || !body.reservaId) throw unavailable();
      return { reservaId: body.reservaId };
    },

    // HU-10: libera una reserva si no se pudo guardar el pedido. Nunca lanza.
    async releaseReservation(reservaId) {
      try {
        const response = await fetchImpl(url(`/api/catalogo/reservas/${encodeURIComponent(reservaId)}`), {
          method: 'DELETE', signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok && response.status !== 404) {
          console.error(`No se pudo liberar la reserva ${reservaId}: HTTP ${response.status}`);
        }
      } catch (e) {
        console.error(`No se pudo liberar la reserva ${reservaId}:`, e.message);
      }
    },
  };
}

module.exports = { ...createCatalogClient(), createCatalogClient };
