const { pool } = require('../db/pool');

// Guarda el pedido y sus ítems en una transacción.
// Idempotente: si el checkout ya estaba registrado, no duplica nada.
async function savePedido(pedido) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertado = await client.query(
      `INSERT INTO pedidos (pedido_id, checkout_id, user_id, estado, reserva_id, subtotal, descuento_total, total, creado_en, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (checkout_id) DO NOTHING
       RETURNING pedido_id`,
      [pedido.pedidoId, pedido.checkoutId, pedido.userId, pedido.estado, pedido.reservaId || null,
        pedido.subtotal, pedido.descuentoTotal, pedido.total, pedido.creadoEn, JSON.stringify(pedido)],
    );
    if (insertado.rowCount === 1) {
      for (const it of pedido.items) {
        await client.query(
          `INSERT INTO pedido_items (pedido_id, product_id, nombre, cantidad, precio_unitario, subtotal_item, descuento_item, total_item)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [pedido.pedidoId, it.productId, it.nombre, it.cantidad, it.precioUnitario,
            it.subtotalItem, it.descuentoAplicadoItem || 0, it.totalItem],
        );
      }
    }
    await client.query('COMMIT');
    return { created: insertado.rowCount === 1 };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Pedidos de un usuario, el más reciente primero. PostgreSQL devuelve BIGINT como texto: se convierte a número.
async function listPedidos(userId, { limit, offset }) {
  const { rows } = await pool.query(
    `SELECT p.pedido_id, p.checkout_id, p.estado, p.subtotal, p.descuento_total, p.total, p.creado_en,
            COALESCE((SELECT SUM(i.cantidad) FROM pedido_items i WHERE i.pedido_id = p.pedido_id), 0) AS unidades
       FROM pedidos p
      WHERE p.user_id = $1
      ORDER BY p.creado_en DESC, p.pedido_id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  const conteo = await pool.query('SELECT COUNT(*)::int AS total FROM pedidos WHERE user_id = $1', [userId]);
  return {
    total: conteo.rows[0].total,
    pedidos: rows.map((r) => ({
      pedidoId: r.pedido_id,
      checkoutId: r.checkout_id,
      estado: r.estado,
      creadoEn: new Date(r.creado_en).toISOString(),
      unidades: Number(r.unidades),
      subtotal: Number(r.subtotal),
      descuentoTotal: Number(r.descuento_total),
      total: Number(r.total),
    })),
  };
}

// El filtro por user_id evita que un usuario lea pedidos de otro (RNF-02)
async function getPedido(userId, pedidoId) {
  const { rows } = await pool.query(
    'SELECT snapshot FROM pedidos WHERE pedido_id = $1 AND user_id = $2',
    [pedidoId, userId],
  );
  return rows[0] ? rows[0].snapshot : null;
}

module.exports = { savePedido, listPedidos, getPedido };