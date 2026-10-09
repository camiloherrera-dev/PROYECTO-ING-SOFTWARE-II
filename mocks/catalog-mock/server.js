const express = require('express');
const app = express();
app.use(express.json());

const productos = {
  prod_001: { id: 'prod_001', nombre: 'Camiseta básica algodón', precio: 49900, activo: true },
  prod_002: { id: 'prod_002', nombre: 'Jean clásico', precio: 129900, activo: true },
  prod_003: { id: 'prod_003', nombre: 'Gorra edición limitada', precio: 35000, activo: false },
};

app.get('/api/catalogo/productos/:id', (req, res) => {
  const p = productos[req.params.id];
  if (!p) {
    return res.status(404).json({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado' });
  }
  res.json(p);
});

// SOLO PARA PRUEBAS: cambiar precio o desactivar un producto
app.patch('/__test/productos/:id', (req, res) => {
  const p = productos[req.params.id];
  if (!p) return res.sendStatus(404);
  Object.assign(p, req.body);
  res.json(p);
});

app.listen(4000, () => console.log('Catalog mock escuchando en :4000'));