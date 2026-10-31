// HU-06 / HU-07: desglose del total con Descuentos. Descuentos NUNCA bloquea el carrito:
// si falla o tarda más que DISCOUNT_TIMEOUT_MS, la respuesta sale sin descuentos y lo indica.
const discountService = require('../discounts/discountService');
const { discountTimeoutMs } = require('../config/env');

async function safeDiscounts(calculate, items, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Descuentos: tiempo agotado')), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => calculate(items)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function buildCartResponse(userId, items, {
  calculate = discountService.calculateDiscounts,
  timeoutMs = discountTimeoutMs,
} = {}) {
  let desc = { porItem: {}, descuentoItems: 0, descuentoCarrito: 0, aplicados: [] };
  let descuentosDisponibles = true;

  if (items.length > 0) {
    try {
      desc = await safeDiscounts(calculate, items.map((i) => ({
        productId: i.productId,
        precioUnitario: i.precioUnitario,
        cantidad: i.cantidad,
        disponible: i.disponible !== false,
      })), timeoutMs);
    } catch (e) {
      console.warn('Descuentos no disponible, se responde sin descuentos:', e.message);
      descuentosDisponibles = false;
      desc = { porItem: {}, descuentoItems: 0, descuentoCarrito: 0, aplicados: [] };
    }
  }

  const lines = items.map((item) => {
    const disponible = item.disponible !== false;
    const subtotalItem = item.precioUnitario * item.cantidad;
    const descuentoAplicadoItem = disponible ? (desc.porItem[item.productId] || 0) : 0;
    const line = {
      productId: item.productId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotalItem,
      descuentoAplicadoItem,
      totalItem: subtotalItem - descuentoAplicadoItem,
      disponible,
    };
    if (item.precioAnterior !== undefined) line.precioAnterior = item.precioAnterior;
    return line;
  });

  const subtotal = lines.reduce((sum, l) => sum + (l.disponible ? l.subtotalItem : 0), 0);
  const descuentoItems = desc.descuentoItems;
  const descuentoCarrito = desc.descuentoCarrito;
  const descuentoTotal = descuentoItems + descuentoCarrito;

  return {
    userId,
    items: lines,
    subtotal,
    descuentoItems,
    descuentoCarrito,
    descuentoTotal,
    total: subtotal - descuentoTotal,
    descuentosAplicados: desc.aplicados,
    descuentosDisponibles,
  };
}

module.exports = { buildCartResponse };