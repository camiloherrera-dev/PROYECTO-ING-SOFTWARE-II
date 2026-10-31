const { createCheckoutService } = require('../src/services/checkoutService');
const AppError = require('../src/errors/AppError');

const camisetas = { productId: 'prod_001', nombre: 'Camiseta', precioUnitario: 49900, cantidad: 3 };
const jeans = { productId: 'prod_002', nombre: 'Jean', precioUnitario: 129900, cantidad: 2 };
const AHORA = Date.parse('2026-11-05T15:15:00Z');

function fixture({ disponible = true, items = [camisetas, jeans], buildResponse } = {}) {
  const repository = { getAllItems: jest.fn().mockResolvedValue(items) };
  const checkouts = { saveCheckout: jest.fn() };
  const availability = { checkAvailability: jest.fn().mockResolvedValue({
    disponible, items: [{ productId: 'prod_002', estado: disponible ? 'OK' : 'SIN_STOCK' }] }) };
  const service = createCheckoutService({ repository, checkouts, availability, now: () => AHORA, ...(buildResponse && { buildResponse }) });
  return { service, repository, checkouts, availability };
}

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('HU-08: createCheckout', () => {
  test('carrito disponible -> snapshot PENDIENTE con descuentos y vence en 15 min', async () => {
    const { service, checkouts } = fixture();
    const c = await service.createCheckout('usr_1');
    expect(c.checkoutId).toMatch(/^chk_/);
    expect(c).toMatchObject({ estado: 'PENDIENTE', expiraEn: '2026-11-05T15:30:00.000Z', userId: 'usr_1', total: 343012, descuentosDisponibles: true });
    expect(checkouts.saveCheckout).toHaveBeenCalledWith(c);
  });

  test('un item no disponible -> 409 CARRITO_NO_DISPONIBLE con items y sin guardar', async () => {
    const { service, checkouts } = fixture({ disponible: false });
    await expect(service.createCheckout('usr_1')).rejects.toMatchObject({
      status: 409, codigo: 'CARRITO_NO_DISPONIBLE', detalles: { items: [expect.objectContaining({ estado: 'SIN_STOCK' })] },
    });
    expect(checkouts.saveCheckout).not.toHaveBeenCalled();
  });

  test('carrito vacío -> el 400 de disponibilidad se propaga', async () => {
    const { service, availability } = fixture();
    availability.checkAvailability.mockRejectedValue(new AppError(400, 'CARRITO_VACIO', 'vacío'));
    await expect(service.createCheckout('usr_1')).rejects.toMatchObject({ status: 400, codigo: 'CARRITO_VACIO' });
  });

  test('Descuentos caído -> 201 igual, con descuentosDisponibles: false', async () => {
    const { buildCartResponse } = require('../src/services/cartTotals');
    const buildResponse = (u, items) => buildCartResponse(u, items, { calculate: async () => { throw new Error('caído'); } });
    const { service } = fixture({ buildResponse });
    const c = await service.createCheckout('usr_1');
    expect(c).toMatchObject({ descuentosDisponibles: false, descuentoTotal: 0, total: 409500 });
  });

  test('cada checkout tiene un id nuevo', async () => {
    const { service } = fixture();
    const a = await service.createCheckout('usr_1');
    const b = await service.createCheckout('usr_1');
    expect(a.checkoutId).not.toBe(b.checkoutId);
  });
});