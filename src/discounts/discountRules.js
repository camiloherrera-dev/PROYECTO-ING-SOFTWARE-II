// Reglas de descuento vigentes. Fuente (DISCOUNT_RULES_SOURCE):
// - "postgres" (por defecto): tabla reglas_descuento (SCRUM-27), con caché de DISCOUNT_RULES_CACHE_MS.
//   Si PostgreSQL falla, se usan las últimas reglas leídas o, si nunca se leyeron, las de RULES.
// - "codigo": solo RULES (es lo que usan las pruebas unitarias).
// Cambiar de fuente SOLO toca este archivo: el motor no sabe de dónde vienen las reglas.
const { discountRulesSource, discountRulesCacheMs } = require('../config/env');

// INT-07: ids de producto configurables, para usar los ids reales de Catálogo sin PR.
const DISCOUNT_JEAN_ID = process.env.DISCOUNT_JEAN_ID || 'prod_002';
const DISCOUNT_CAMISETA_ID = process.env.DISCOUNT_CAMISETA_ID || 'prod_001';

const RULES = [
  {
    id: 'DESC-JEAN-10',
    tipo: 'PORCENTAJE_PRODUCTO',
    descripcion: '10% en Jean clásico',
    productIds: [DISCOUNT_JEAN_ID],
    porcentaje: 10,
    activa: true,
  },
  {
    id: 'DESC-CAMISETA-3X',
    tipo: 'CANTIDAD_MINIMA',
    descripcion: '15% llevando 3 o más camisetas',
    productIds: [DISCOUNT_CAMISETA_ID],
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

// Caché de reglas leídas con load(). Las peticiones simultáneas comparten una sola lectura.
// Un fallo también se recuerda durante cacheMs, para no consultar PostgreSQL en cada petición si está caído.
function createRuleSource({ load, cacheMs, fallback = RULES, clock = Date.now, logger = console }) {
  let cache = null;
  let loadedAt = 0;
  let inflight = null;

  async function refresh() {
    try {
      cache = await load();
    } catch (e) {
      logger.warn(`Reglas de descuento: PostgreSQL no disponible, se usan las ${cache ? 'últimas leídas' : 'del código'}:`, e.message);
    } finally {
      loadedAt = clock();
      inflight = null;
    }
  }

  async function getRules() {
    if (!inflight && (loadedAt === 0 || clock() - loadedAt >= cacheMs)) inflight = refresh();
    if (inflight) await inflight;
    return cache || fallback;
  }

  return { getRules };
}

// INT-07 + SCRUM-27: si DISCOUNT_JEAN_ID o DISCOUNT_CAMISETA_ID están definidas, también reemplazan los
// productIds de esas reglas cuando vienen de PostgreSQL (la tabla se sembró con prod_001 y prod_002).
const PRODUCT_ID_OVERRIDES = {
  'DESC-JEAN-10': process.env.DISCOUNT_JEAN_ID,
  'DESC-CAMISETA-3X': process.env.DISCOUNT_CAMISETA_ID,
};

function withProductIdOverrides(rules, overrides = PRODUCT_ID_OVERRIDES) {
  return rules.map((r) => (overrides[r.id] ? { ...r, productIds: [overrides[r.id]] } : r));
}

const source = discountRulesSource === 'postgres'
  ? createRuleSource({
    // require diferido: con la fuente "codigo" no se carga el pool de PostgreSQL
    load: async () => withProductIdOverrides(
      await require('../repositories/discountRuleRepository').findAllRules(),
    ),
    cacheMs: discountRulesCacheMs,
  })
  : { getRules: async () => RULES };

async function getActiveRules(now = new Date()) {
  const rules = await source.getRules();
  return rules.filter((r) => isActive(r, now));
}

module.exports = { getActiveRules, createRuleSource, withProductIdOverrides, isActive, RULES };
