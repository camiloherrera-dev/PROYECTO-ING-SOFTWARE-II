// SCRUM-27: fuente de reglas en PostgreSQL con caché y respaldo (TC-76)
const { createRuleSource, getActiveRules, RULES } = require('../src/discounts/discountRules');
const { toRule } = require('../src/repositories/discountRuleRepository');

const jean = (activa = true) => ({ ...RULES[0], activa });
const silentLogger = { warn: jest.fn() };

function fixture(loads, cacheMs = 60000) {
  let t = 1000;
  const load = jest.fn();
  loads.forEach((l) => load.mockImplementationOnce(l));
  const source = createRuleSource({ load, cacheMs, clock: () => t, logger: silentLogger });
  return { source, load, advance: (ms) => { t += ms; } };
}

test('en las pruebas la fuente por defecto es el código (no abre PostgreSQL)', async () => {
  expect((await getActiveRules()).map((r) => r.id)).toEqual(RULES.map((r) => r.id));
});

test('lee las reglas una vez y las reutiliza mientras dura el caché', async () => {
  const f = fixture([async () => [jean()]]);
  expect(await f.source.getRules()).toEqual([jean()]);
  f.advance(59999);
  expect(await f.source.getRules()).toEqual([jean()]);
  expect(f.load).toHaveBeenCalledTimes(1);
});

test('TC-76: al vencer el caché toma el cambio hecho en PostgreSQL', async () => {
  const f = fixture([async () => [jean(true)], async () => [jean(false)]]);
  expect((await f.source.getRules())[0].activa).toBe(true);
  f.advance(60000);
  expect((await f.source.getRules())[0].activa).toBe(false);
  expect(f.load).toHaveBeenCalledTimes(2);
});

test('peticiones simultáneas comparten una sola lectura', async () => {
  const f = fixture([async () => [jean()]]);
  await Promise.all([f.source.getRules(), f.source.getRules(), f.source.getRules()]);
  expect(f.load).toHaveBeenCalledTimes(1);
});

test('si PostgreSQL falla desde el inicio, usa las reglas del código', async () => {
  const f = fixture([async () => { throw new Error('ECONNREFUSED'); }]);
  expect(await f.source.getRules()).toBe(RULES);
  expect(silentLogger.warn).toHaveBeenCalled();
});

test('si PostgreSQL falla después, conserva las últimas reglas leídas y reintenta al vencer el caché', async () => {
  const f = fixture([
    async () => [jean(false)],
    async () => { throw new Error('timeout'); },
    async () => [jean(true)],
  ]);
  await f.source.getRules();
  f.advance(60000);
  expect(await f.source.getRules()).toEqual([jean(false)]);
  f.advance(1000);
  await f.source.getRules();
  expect(f.load).toHaveBeenCalledTimes(2); // el fallo también se recuerda durante el caché
  f.advance(60000);
  expect(await f.source.getRules()).toEqual([jean(true)]);
});

test('una tabla vacía significa que no hay descuentos (no vuelve a las del código)', async () => {
  const f = fixture([async () => []]);
  expect(await f.source.getRules()).toEqual([]);
});

test('toRule convierte la fila de PostgreSQL al formato del motor', () => {
  expect(toRule({
    id: 'DESC-CARRITO-300K', tipo: 'MONTO_MINIMO_CARRITO', descripcion: '5%', product_ids: null,
    cantidad_minima: null, monto_minimo: '300000', porcentaje: '5.00', activa: true,
    vigente_desde: null, vigente_hasta: new Date('2026-12-31T00:00:00Z'),
  })).toEqual({
    id: 'DESC-CARRITO-300K', tipo: 'MONTO_MINIMO_CARRITO', descripcion: '5%', montoMinimo: 300000,
    porcentaje: 5, activa: true, vigenteHasta: '2026-12-31T00:00:00.000Z',
  });
  expect(toRule({
    id: 'DESC-CAMISETA-3X', tipo: 'CANTIDAD_MINIMA', descripcion: '15%', product_ids: ['prod_001'],
    cantidad_minima: 3, monto_minimo: null, porcentaje: '15.00', activa: false,
  })).toEqual({
    id: 'DESC-CAMISETA-3X', tipo: 'CANTIDAD_MINIMA', descripcion: '15%', productIds: ['prod_001'],
    cantidadMinima: 3, porcentaje: 15, activa: false,
  });
});

test('INT-07: los ids configurados reemplazan los productIds de las reglas leídas de PostgreSQL', () => {
  const { withProductIdOverrides } = require('../src/discounts/discountRules');
  const leidas = [{ ...RULES[0], productIds: ['prod_002'] }, RULES[2]];
  const r = withProductIdOverrides(leidas, { 'DESC-JEAN-10': '64f1a2b3c9e77a001f3d8e22' });
  expect(r[0].productIds).toEqual(['64f1a2b3c9e77a001f3d8e22']);
  expect(r[1]).toBe(RULES[2]);
  expect(withProductIdOverrides(leidas, {})).toEqual(leidas);
});
