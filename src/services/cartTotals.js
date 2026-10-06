// Base compartida mínima tomada del contrato del sprint. Sin descuentos en Sprint 1.
function buildCartResponse(userId, items) {
  const lines = items.map((item) => {
    const subtotalItem = item.precioUnitario * item.cantidad;
    const line = {
      productId: item.productId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotalItem,
      descuentoAplicadoItem: 0,
      totalItem: subtotalItem,
      disponible: item.disponible !== false,
    };
    if (item.precioAnterior !== undefined) line.precioAnterior = item.precioAnterior;
    return line;
  });
  const subtotal = lines.reduce((sum, item) => sum + (item.disponible ? item.subtotalItem : 0), 0);
  return { userId, items: lines, subtotal, descuentoTotal: 0, total: subtotal };
}

module.exports = { buildCartResponse };
