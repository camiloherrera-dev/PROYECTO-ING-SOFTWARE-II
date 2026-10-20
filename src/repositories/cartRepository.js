// Punto de integración pendiente: Jeisson implementa Redis.
// Fallar explícitamente evita presentar un carrito vacío como si hubiera persistencia.
async function pending() {
  throw new Error('Repositorio Redis pendiente de integración con el trabajo de Jeisson');
}

module.exports = { getItem: pending, getAllItems: pending, saveItem: pending };
