const { catalogBaseUrl, catalogTimeoutMs } = require('../config/env');
const AppError = require('../errors/AppError');

// Contrato con Catálogo (acuerdo del 27/10/2026):
//   GET  {base}/productos/{id}               → { id, nombre, precio, activo, stock, ... } · 404 si el id no existe
//   POST {base}/productos/descontar-stock    → { items: [{ id, cantidad }], referencia? } · 200 · 409 STOCK_INSUFICIENTE
//   POST {base}/productos/devolver-stock     → { referencia } (PROPUESTO, aún no existe en Catálogo)
// {base} = CATALOG_BASE_URL e INCLUYE el prefijo: http://catalog-mock:4000/api/catalogo (mock),
// http://localhost:8000/api/catalogo (Kong de Catálogo) o http://host.docker.internal:8080 (directo, sin prefijo).

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

// Adaptar solo aquí los nombres de campos. Los ids de Catálogo son ObjectId de MongoDB (texto).
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

// El 409 de Catálogo trae los ids en el mensaje; si algún día trae items en el cuerpo, se usan esos.
function itemsSinStock(body, items) {
  if (Array.isArray(body?.items)) {
    return body.items.map((i) => ({ ...i, productId: String(i.productId ?? i.id) }));
  }
  const mensaje = typeof body?.mensaje === 'string' ? body.mensaje : '';
  return items.filter((i) => mensaje.includes(i.productId));
}

// Inyección opcional para pruebas; los consumidores usan getProduct, reserveStock y releaseReservation.
function createCatalogClient({ baseUrl = catalogBaseUrl, timeoutMs = catalogTimeoutMs,
  fetchImpl = globalThis.fetch } = {}) {
  const url = (path) => `${baseUrl.replace(/\/+$/, '')}${path}`;
  const post = (path, body) => fetchImpl(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    async getProduct(productId) {
      try {
        const response = await fetchImpl(
          url(`/productos/${encodeURIComponent(productId)}`),
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

    // HU-10: descuenta el stock del pedido (todo o nada). La referencia es el checkoutId:
    // Catálogo la ignora hoy; cuando la acepte, un reintento no descontará dos veces.
    async reserveStock(referencia, items) {
      let response;
      let body;
      try {
        response = await post('/productos/descontar-stock', {
          referencia,
          items: items.map((i) => ({ id: i.productId, cantidad: i.cantidad })),
        });
        body = await response.json().catch(() => null);
      } catch {
        throw unavailable();
      }
      if (response.status === 409) {
        throw new AppError(409, 'STOCK_INSUFICIENTE', 'No hay stock suficiente para algunos productos',
          { items: itemsSinStock(body, items) });
      }
      if (!response.ok) throw unavailable();
      return { reservaId: referencia }; // Catálogo no devuelve un id de reserva: se usa la referencia
    },

    // HU-10: devuelve el stock si no se pudo guardar el pedido. Nunca lanza.
    // devolver-stock está PROPUESTO a Catálogo; mientras no exista, el fallo queda en consola
    // para devolver el stock a mano.
    async releaseReservation(reservaId) {
      try {
        const response = await post('/productos/devolver-stock', { referencia: reservaId });
        if (!response.ok) {
          console.error(`No se pudo devolver el stock de ${reservaId}: HTTP ${response.status}. Devolverlo a mano en Catálogo.`);
        }
      } catch (e) {
        console.error(`No se pudo devolver el stock de ${reservaId}: ${e.message}. Devolverlo a mano en Catálogo.`);
      }
    },
  };
}

module.exports = { ...createCatalogClient(), createCatalogClient };
