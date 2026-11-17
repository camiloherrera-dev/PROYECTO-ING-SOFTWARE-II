const { pool } = require('../db/pool');

// SCRUM-27: reglas de descuento en PostgreSQL (tabla reglas_descuento, migración 002).
// Devuelve TODAS las reglas, también las inactivas: el filtro de activa y vigencia lo hace discountRules.
// PostgreSQL devuelve NUMERIC y BIGINT como texto: se convierten a número.
function toRule(r) {
  const rule = {
    id: r.id,
    tipo: r.tipo,
    descripcion: r.descripcion,
    porcentaje: Number(r.porcentaje),
    activa: r.activa,
  };
  if (r.product_ids) rule.productIds = r.product_ids;
  if (r.cantidad_minima != null) rule.cantidadMinima = Number(r.cantidad_minima);
  if (r.monto_minimo != null) rule.montoMinimo = Number(r.monto_minimo);
  if (r.vigente_desde) rule.vigenteDesde = new Date(r.vigente_desde).toISOString();
  if (r.vigente_hasta) rule.vigenteHasta = new Date(r.vigente_hasta).toISOString();
  return rule;
}

async function findAllRules() {
  const { rows } = await pool.query(
    `SELECT id, tipo, descripcion, product_ids, cantidad_minima, monto_minimo, porcentaje, activa,
            vigente_desde, vigente_hasta
       FROM reglas_descuento
      ORDER BY id`,
  );
  return rows.map(toRule);
}

module.exports = { findAllRules, toRule };
