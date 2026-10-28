const { buildCartResponse } = require('../src/services/cartTotals');

const camisetas = { productId: 'prod_001', nombre: 'Camiseta', precioUnitario: 49900, cantidad: 3 };
const jeans = { productId: 'prod_002', nombre: 'Jean', precioUnitario: 129900, cantidad: 2 };

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('HU-06/HU-07: cartTotals con Descuentos', () => {
  test('caso de la demo: 3 camisetas + 2 jeans -> total 343.012', async () => {
    const cart = await buildCartResponse('usr_1', [camisetas, jeans]);
    expect(cart.items[0]).toMatchObject({ subtotalItem: 149700, descuentoAplicadoItem: 22455, totalItem: 127245 });
    expect(cart.items[1]).toMatchObject({ subtotalItem: 259800, descuentoAplicadoItem: 25980, totalItem: 233820 });
    expect(cart).toMatchObject({
      subtotal: 409500,
      descuentoItems: 48435,
      descuentoCarrito: 18053,
      descuentoTotal: 66488,
      total: 343012,
      descuentosDisponibles: true,
    });
    expect(cart.descuentosAplicados).toHaveLength(3);
  });

  test('un producto no disponible no suma ni recibe descuento', async () => {
    const cart = await buildCartResponse('usr_1', [camisetas, { ...jeans, disponible: false }]);
    expect(cart.items[1]).toMatchObject({ disponible: false, descuentoAplicadoItem: 0 });
    expect(cart.subtotal).toBe(149700);
  });

  test('Descuentos lanza error -> sin descuentos y descuentosDisponibles: false', async () => {
    const calculate = async () => { throw new Error('caído'); };
    const cart = await buildCartResponse('usr_1', [camisetas], { calculate });
    expect(cart).toMatchObject({ descuentoTotal: 0, total: 149700, descuentosDisponibles: false });
  });

  test('Descuentos lanza error sincrono -> mismo modo degradado', async () => {
    const calculate = () => { throw new Error('sincrono'); };
    const cart = await buildCartResponse('usr_1', [camisetas], { calculate });
    expect(cart.descuentosDisponibles).toBe(false);
  });

  test('Descuentos tarda más que el timeout -> responde sin esperar', async () => {
    const calculate = () => new Promise(() => {});
    const inicio = Date.now();
    const cart = await buildCartResponse('usr_1', [camisetas], { calculate, timeoutMs: 50 });
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(cart.descuentosDisponibles).toBe(false);
  });

  test('carrito vacío no llama a Descuentos', async () => {
    const calculate = jest.fn();
    const cart = await buildCartResponse('usr_1', [], { calculate });
    expect(calculate).not.toHaveBeenCalled();
    expect(cart).toMatchObject({ items: [], total: 0, descuentosDisponibles: true });
  });
});