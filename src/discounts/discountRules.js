// Reglas de descuento vigentes (Sprint 2: en código; Sprint 4 o posterior: tabla en PostgreSQL).
// Cambiar de fuente SOLO toca getActiveRules: el motor no sabe de dónde vienen las reglas.
const RULES = [
  {
    id: 'DESC-JEAN-10',
    tipo: 'PORCENTAJE_PRODUCTO',
    descripcion: '10% en Jean clásico',
    productIds: ['prod_002'],
    porcentaje: 10,
    activa: true,
  },
  {
    id: 'DESC-CAMISETA-3X',
    tipo: 'CANTIDAD_MINIMA',
    descripcion: '15% llevando 3 o más camisetas',
    productIds: ['prod_001'],
    cantidadMinima: 3,
    porcentaje: 15,
    activa: true,
  },
  {
    id: 'DESC-CARRITO-300K',
    tipo: 'MONTO_MINIMO_CARRITO',
    descripcion: '5% adicional en compras desde $300.000',
    montoMinimo: 300000,
    porcentaje: 5,
    activa: true,
  },
];

function isActive(rule, now) {
  if (!rule.activa) return false;
  if (rule.vigenteDesde && now < new Date(rule.vigenteDesde)) return false;
  if (rule.vigenteHasta && now > new Date(rule.vigenteHasta)) return false;
  return true;
}

async function getActiveRules(now = new Date()) {
  return RULES.filter((r) => isActive(r, now));
}

module.exports = { getActiveRules, RULES };
