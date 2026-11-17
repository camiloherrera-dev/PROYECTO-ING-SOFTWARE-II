// SCRUM-27 / TC-76 contra PostgreSQL real: desactivar una regla en la tabla quita el descuento.
// Usa una regla y un producto propios (DESC-INT-*, prod_int_*) para no tocar las reglas sembradas de QA.
const { pool, unico, abrirPostgres, cerrar } = require('./setup');
const repo = require('../../src/repositories/discountRuleRepository');
const { createRuleSource, isActive } = require('../../src/discounts/discountRules');
const { createDiscountService } = require('../../src/discounts/discountService');

beforeAll(abrirPostgres);
afterAll(cerrar);
afterEach(() => pool.query("DELETE FROM reglas_descuento WHERE id LIKE 'DESC-INT-%'"));

test('las reglas sembradas por la migración se leen con el formato del motor', async () => {
  const reglas = await repo.findAllRules();
  const ids = reglas.map((r) => r.id);
  expect(ids).toEqual(expect.arrayContaining(['DESC-JEAN-10', 'DESC-CAMISETA-3X', 'DESC-CARRITO-300K']));
  expect(reglas.find((r) => r.id === 'DESC-CARRITO-300K')).toMatchObject({ montoMinimo: 300000, porcentaje: 5 });
});

test('TC-76: desactivar la regla en PostgreSQL quita el descuento al vencer el caché', async () => {
  const reglaId = unico('DESC-INT');
  const productId = unico('prod_int');
  await pool.query(
    `INSERT INTO reglas_descuento (id, tipo, descripcion, product_ids, porcentaje, activa)
     VALUES ($1, 'PORCENTAJE_PRODUCTO', '10% de prueba', ARRAY[$2], 10, TRUE)`,
    [reglaId, productId],
  );
  // cacheMs 0: cada consulta lee la tabla (equivale a esperar a que venza el caché)
  const source = createRuleSource({ load: repo.findAllRules, cacheMs: 0 });
  const rules = { getActiveRules: async () => (await source.getRules()).filter((r) => isActive(r, new Date())) };
  const { calculateDiscounts } = createDiscountService({ rules });
  const items = [{ productId, precioUnitario: 129900, cantidad: 2, disponible: true }];

  expect((await calculateDiscounts(items)).porItem[productId]).toBe(25980);

  await pool.query('UPDATE reglas_descuento SET activa = FALSE WHERE id = $1', [reglaId]);
  const sinRegla = await calculateDiscounts(items);
  expect(sinRegla.porItem[productId]).toBe(0);
  expect(sinRegla.aplicados.map((a) => a.reglaId)).not.toContain(reglaId);
});
