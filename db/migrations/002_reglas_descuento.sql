-- Reglas de descuento (stretch de Santiago). Los product_ids son los del mock de Catálogo;
-- se ajustan cuando se integre con el Catálogo real.
CREATE TABLE IF NOT EXISTS reglas_descuento (
  id              TEXT PRIMARY KEY,
  tipo            TEXT NOT NULL CHECK (tipo IN ('PORCENTAJE_PRODUCTO', 'CANTIDAD_MINIMA', 'MONTO_MINIMO_CARRITO')),
  descripcion     TEXT NOT NULL,
  product_ids     TEXT[],
  cantidad_minima INTEGER,
  monto_minimo    BIGINT,
  porcentaje      NUMERIC(5, 2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde   TIMESTAMPTZ,
  vigente_hasta   TIMESTAMPTZ
);

INSERT INTO reglas_descuento (id, tipo, descripcion, product_ids, cantidad_minima, monto_minimo, porcentaje, activa) VALUES
  ('DESC-JEAN-10',      'PORCENTAJE_PRODUCTO',  '10% en Jean clásico',                    ARRAY['prod_002'], NULL, NULL,   10, TRUE),
  ('DESC-CAMISETA-3X',  'CANTIDAD_MINIMA',      '15% llevando 3 o más camisetas',         ARRAY['prod_001'], 3,    NULL,   15, TRUE),
  ('DESC-CARRITO-300K', 'MONTO_MINIMO_CARRITO', '5% adicional en compras desde $300.000', NULL,              NULL, 300000, 5,  TRUE)
ON CONFLICT (id) DO NOTHING;
