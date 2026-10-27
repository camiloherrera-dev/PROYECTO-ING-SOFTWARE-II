const express = require('express');
const app = express();
app.use(express.json());

const productos = {
  prod_001: { id: 'prod_001', nombre: 'Camiseta básica algodón', precio: 49900, activo: true, stock: 20 },
  prod_002: { id: 'prod_002', nombre: 'Jean clásico', precio: 129900, activo: true, stock: 10 },
  prod_003: { id: 'prod_003', nombre: 'Gorra edición limitada', precio: 35000, activo: false, stock: 0 },
};
const reservas = {}; // referencia → { reservaId, items }
let siguienteReserva = 1; // contador: un reservaId nunca se repite

app.get('/api/catalogo/productos/:id', (req, res) => {
  const p = productos[req.params.id];
  if (!p) {
    return res.status(404).json({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado' });
  }
  res.json(p);
});

// HU-10: reservar stock. Idempotente por referencia (el checkoutId del carrito).
app.post('/api/catalogo/reservas', (req, res) => {
  const { referencia, items } = req.body || {};
  if (typeof referencia !== 'string' || !Array.isArray(items) || items.length === 0
    || items.some((i) => typeof i?.productId !== 'string' || !Number.isInteger(i.cantidad) || i.cantidad < 1)) {
    return res.status(400).json({ codigo: 'VALIDACION_FALLIDA', mensaje: 'referencia e items son obligatorios' });
  }
  if (reservas[referencia]) return res.status(201).json({ reservaId: reservas[referencia].reservaId });

  const faltan = items.filter((i) => !productos[i.productId] || !productos[i.productId].activo
    || productos[i.productId].stock < i.cantidad)
    .map((i) => ({ productId: i.productId, cantidad: i.cantidad, stock: productos[i.productId]?.stock ?? 0 }));
  if (faltan.length) {
    return res.status(409).json({ codigo: 'STOCK_INSUFICIENTE', mensaje: 'Stock insuficiente', items: faltan });
  }

  items.forEach((i) => { productos[i.productId].stock -= i.cantidad; });
  const reservaId = `res_${siguienteReserva++}`;
  reservas[referencia] = { reservaId, items };
  res.status(201).json({ reservaId });
});

// HU-10: liberar una reserva (devuelve el stock). Idempotente: 204 aunque no exista.
app.delete('/api/catalogo/reservas/:reservaId', (req, res) => {
  const ref = Object.keys(reservas).find((r) => reservas[r].reservaId === req.params.reservaId);
  if (ref) {
    reservas[ref].items.forEach((i) => { productos[i.productId].stock += i.cantidad; });
    delete reservas[ref];
  }
  res.sendStatus(204);
});

// SOLO PARA PRUEBAS: cambiar precio, stock o desactivar un producto
app.patch('/__test/productos/:id', (req, res) => {
  const p = productos[req.params.id];
  if (!p) return res.sendStatus(404);
  Object.assign(p, req.body);
  res.json(p);
});

app.listen(4000, () => console.log('Catalog mock escuchando en :4000'));
