const { catalogBaseUrl, catalogTimeoutMs } = require('../config/env');
const AppError = require('../errors/AppError');

const unavailable = () => new AppError(
  503, 'CATALOGO_NO_DISPONIBLE', 'No fue posible consultar el servicio de Catálogo',
);

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
  return { productId: String(id), nombre: product.nombre, precio: price, activo: product.activo };
}

// Inyección opcional para pruebas; los consumidores usan getProduct(productId).
function createCatalogClient({ baseUrl = catalogBaseUrl, timeoutMs = catalogTimeoutMs,
  fetchImpl = globalThis.fetch } = {}) {
  return {
    async getProduct(productId) {
      try {
        const response = await fetchImpl(
          `${baseUrl.replace(/\/+$/, '')}/api/catalogo/productos/${encodeURIComponent(productId)}`,
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
  };
}

module.exports = { ...createCatalogClient(), createCatalogClient };
