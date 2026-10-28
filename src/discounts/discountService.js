// Módulo Descuentos (HU-06 / HU-07). Función interna del mismo proceso: sin gRPC ni red.
// Política: por ítem se aplica SOLO la mejor regla (no se acumulan);
// después, la regla de carrito se calcula sobre lo que queda (subtotal − descuentos por ítem). Pesos COP enteros.

const discountRules = require('./discountRules');

const pct = (base, porcentaje) => Math.round((base * porcentaje) / 100);

function itemRuleAmount(rule, item) {
  const subtotalItem = item.precioUnitario * item.cantidad;
  if (!rule.productIds || !rule.productIds.includes(item.productId)) return 0;
  if (rule.tipo === 'PORCENTAJE_PRODUCTO') return pct(subtotalItem, rule.porcentaje);
  if (rule.tipo === 'CANTIDAD_MINIMA') {
    return item.cantidad >= rule.cantidadMinima ? pct(subtotalItem, rule.porcentaje) : 0;
  }
  return 0;
}

function createDiscountService({ rules = discountRules } = {}) {
  // items: [{ productId, precioUnitario, cantidad, disponible }]
  // → { porItem: { [productId]: monto }, descuentoItems, descuentoCarrito, aplicados: [...] }
  async function calculateDiscounts(items) {
    const activas = await rules.getActiveRules();
    const porItem = {};
    const aplicados = [];
    let descuentoItems = 0;
    let base = 0;
    for (const item of items) {
      if (item.disponible === false) continue;
      const subtotalItem = item.precioUnitario * item.cantidad;
      let mejor = null;
      for (const rule of activas) {
        const monto = Math.min(itemRuleAmount(rule, item), subtotalItem);
        if (monto > 0 && (!mejor || monto > mejor.monto)) mejor = { rule, monto };
      }
      porItem[item.productId] = mejor ? mejor.monto : 0;
      if (mejor) {
        descuentoItems += mejor.monto;
        aplicados.push({
          reglaId: mejor.rule.id,
          tipo: mejor.rule.tipo,
          descripcion: mejor.rule.descripcion,
          productId: item.productId,
          monto: mejor.monto,
        });
      }
      base += subtotalItem - porItem[item.productId];
    }
    // Regla de carrito: también solo la mejor, calculada sobre lo que queda tras los descuentos por ítem
    let mejorCarrito = null;
    for (const rule of activas) {
      if (rule.tipo !== 'MONTO_MINIMO_CARRITO' || base < rule.montoMinimo) continue;
      const monto = Math.min(pct(base, rule.porcentaje), base);
      if (monto > 0 && (!mejorCarrito || monto > mejorCarrito.monto)) mejorCarrito = { rule, monto };
    }
    const descuentoCarrito = mejorCarrito ? mejorCarrito.monto : 0;
    if (mejorCarrito) {
      aplicados.push({
        reglaId: mejorCarrito.rule.id,
        tipo: mejorCarrito.rule.tipo,
        descripcion: mejorCarrito.rule.descripcion,
        productId: null,
        monto: descuentoCarrito,
      });
    }
    return { porItem, descuentoItems, descuentoCarrito, aplicados };
  }
  return { calculateDiscounts };
}

module.exports = { ...createDiscountService(), createDiscountService };
