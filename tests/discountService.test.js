const { createDiscountService } = require('../src/discounts/discountService');
const { RULES } = require('../src/discounts/discountRules');

const service = (rules = RULES) => createDiscountService({ rules: { getActiveRules: async () => rules } });
const item = (productId, precioUnitario, cantidad, disponible = true) =>
  ({ productId, precioUnitario, cantidad, disponible });

test('sin reglas aplicables no hay descuento', async () => {
  const r = await service().calculateDiscounts([item('prod_001', 49900, 1)]);
  expect(r).toEqual({ porItem: { prod_001: 0 }, descuentoItems: 0, descuentoCarrito: 0, aplicados: [] });
});

test('PORCENTAJE_PRODUCTO: 10% sobre el subtotal del ítem', async () => {
  const r = await service().calculateDiscounts([item('prod_002', 129900, 1)]);
  expect(r.porItem.prod_002).toBe(12990);
  expect(r.aplicados[0]).toMatchObject({ reglaId: 'DESC-JEAN-10', productId: 'prod_002', monto: 12990 });
});

test('CANTIDAD_MINIMA: no aplica con 2 unidades, sí con 3', async () => {
  expect((await service().calculateDiscounts([item('prod_001', 49900, 2)])).descuentoItems).toBe(0);
  expect((await service().calculateDiscounts([item('prod_001', 49900, 3)])).descuentoItems).toBe(22455);
});

test('MONTO_MINIMO_CARRITO se calcula sobre lo que queda tras los descuentos por ítem', async () => {
  // 3 camisetas (149.700 − 22.455) + 2 jeans (259.800 − 25.980) = 361.065 ≥ 300.000 → 5% = 18.053
  const r = await service().calculateDiscounts([item('prod_001', 49900, 3), item('prod_002', 129900, 2)]);
  expect(r.descuentoItems).toBe(48435);
  expect(r.descuentoCarrito).toBe(18053);
  expect(r.aplicados.map((a) => a.reglaId)).toEqual(['DESC-CAMISETA-3X', 'DESC-JEAN-10', 'DESC-CARRITO-300K']);
});

test('no supera el umbral de carrito si los descuentos por ítem lo dejan por debajo', async () => {
  // 279.600 de subtotal, pero 244.155 después de descuentos por ítem → sin descuento de carrito
  const r = await service().calculateDiscounts([item('prod_001', 49900, 3), item('prod_002', 129900, 1)]);
  expect(r.descuentoCarrito).toBe(0);
});

test('por ítem solo se aplica la mejor regla (no se acumulan)', async () => {
  const reglas = [
    { id: 'A', tipo: 'PORCENTAJE_PRODUCTO', productIds: ['p1'], porcentaje: 5, activa: true },
    { id: 'B', tipo: 'PORCENTAJE_PRODUCTO', productIds: ['p1'], porcentaje: 20, activa: true },
  ];
  const r = await service(reglas).calculateDiscounts([item('p1', 1000, 1)]);
  expect(r.porItem.p1).toBe(200);
  expect(r.aplicados).toHaveLength(1);
});

test('los ítems no disponibles no reciben descuento ni cuentan para el umbral', async () => {
  const r = await service().calculateDiscounts([item('prod_002', 129900, 3, false)]);
  expect(r).toEqual({ porItem: {}, descuentoItems: 0, descuentoCarrito: 0, aplicados: [] });
});

test('el descuento nunca supera el subtotal del ítem', async () => {
  const reglas = [{ id: 'X', tipo: 'PORCENTAJE_PRODUCTO', productIds: ['p1'], porcentaje: 150, activa: true }];
  expect((await service(reglas).calculateDiscounts([item('p1', 1000, 1)])).porItem.p1).toBe(1000);
});
