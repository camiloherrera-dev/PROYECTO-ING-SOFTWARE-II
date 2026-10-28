const express = require('express');
const app = express();
app.use(express.json());

// Copia del contrato real de Catálogo (acuerdo del 27/10/2026). Los ids reales son ObjectId de
// MongoDB; aquí se usan prod_00X para la demo.
const productos = {
  prod_001: { id: 'prod_001', nombre: 'Camiseta básica algodón', precio: 49900, activo: true, stock: 20, categoria: 'cat-ropa' },
  prod_002: { id: 'prod_002', nombre: 'Jean clásico', precio: 129900, activo: true, stock: 10, categoria: 'cat-ropa' },
  prod_003: { id: 'prod_003', nombre: 'Gorra edición limitada', precio: 35000, activo: false, stock: 0, categoria: 'cat-accesorios' },
};
const descuentos = {}; // referencia → items descontados (PROPUESTO: hoy Catálogo no guarda referencia)

// Como Catálogo: inactivo responde 200 con activo: false; 404 solo si el id no existe.
app.get('/api/catalogo/productos/:id', (req, res) => {
  const p = productos[req.params.id];
  if (!p) {
    return res.status(404).json({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado' });
  }
  res.json(p);
});

// Como Catálogo: descuenta todo o nada. 200 { items: [{ id, stockRestante }] } · 409 con los ids en el mensaje.
// PROPUESTO (aún no en Catálogo): con "referencia", repetir la misma no descuenta otra vez.
app.post('/api/catalogo/productos/descontar-stock', (req, res) => {
  const { referencia, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0
    || items.some((i) => typeof i?.id !== 'string' || !Number.isInteger(i.cantidad) || i.cantidad < 1)) {
    return res.status(400).json({ codigo: 'VALIDACION_FALLIDA', mensaje: 'items es obligatorio: [{ id, cantidad }]' });
  }
  const respuesta = (its) => ({ items: its.map((i) => ({ id: i.id, stockRestante: productos[i.id].stock })) });
  if (referencia && descuentos[referencia]) return res.json(respuesta(descuentos[referencia]));

  const faltan = items.filter((i) => !productos[i.id] || productos[i.id].stock < i.cantidad).map((i) => i.id);
  if (faltan.length) {
    return res.status(409).json({ codigo: 'STOCK_INSUFICIENTE', mensaje: `Stock insuficiente para: ${faltan.join(', ')}` });
  }
  items.forEach((i) => { productos[i.id].stock -= i.cantidad; });
  if (referencia) descuentos[referencia] = items;
  res.json(respuesta(items));
});

// PROPUESTO (aún no en Catálogo): devolver el stock de una referencia. Idempotente.
app.post('/api/catalogo/productos/devolver-stock', (req, res) => {
  const { referencia } = req.body || {};
  const items = descuentos[referencia];
  if (items) {
    items.forEach((i) => { productos[i.id].stock += i.cantidad; });
    delete descuentos[referencia];
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
