-- HU-11: histórico de pedidos confirmados
CREATE TABLE IF NOT EXISTS pedidos (
  pedido_id       TEXT PRIMARY KEY,
  checkout_id     TEXT NOT NULL UNIQUE,
  user_id         TEXT NOT NULL,
  estado          TEXT NOT NULL,
  reserva_id      TEXT,
  subtotal        BIGINT NOT NULL,
  descuento_total BIGINT NOT NULL,
  total           BIGINT NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL,
  snapshot        JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_fecha ON pedidos (user_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS pedido_items (
  pedido_id       TEXT NOT NULL REFERENCES pedidos (pedido_id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario BIGINT NOT NULL,
  subtotal_item   BIGINT NOT NULL,
  descuento_item  BIGINT NOT NULL,
  total_item      BIGINT NOT NULL,
  PRIMARY KEY (pedido_id, product_id)
);
