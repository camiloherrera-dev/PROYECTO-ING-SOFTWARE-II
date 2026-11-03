// Sprint 3: sin reglas de descuento, para probar solo la lógica de esta HU
jest.mock('../src/discounts/discountRules', () => ({ getActiveRules: async () => [] }));

jest.mock('../src/repositories/cartRepository', () => ({
  getItem: jest.fn(),
  getAllItems: jest.fn(),
  saveItem: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
}));

jest.mock('../src/clients/catalogClient');

const repo = require('../src/repositories/cartRepository');
const catalog = require('../src/clients/catalogClient');
const service = require('../src/services/cartService');

const it = (productId, cantidad, precioUnitario) => ({
  productId,
  nombre: productId,
  precioUnitario,
  cantidad,
});

beforeEach(() => jest.resetAllMocks());

describe('HU-04: removeItem', () => {
  test('elimina y recalcula el total sin el producto', async () => {
    repo.removeItem.mockResolvedValue(true);
    repo.getAllItems.mockResolvedValue([it('prod_002', 1, 129900)]);

    const cart = await service.removeItem('usr_1', 'prod_001');

    expect(repo.removeItem).toHaveBeenCalledWith('usr_1', 'prod_001');
    expect(cart.items.map((i) => i.productId)).toEqual(['prod_002']);
    expect(cart.total).toBe(129900);
  });

  test('producto ausente 404 PRODUCTO_NO_ENCONTRADO', async () => {
    repo.removeItem.mockResolvedValue(false);

    await expect(service.removeItem('usr_1', 'prod_777')).rejects.toMatchObject({
      status: 404,
      codigo: 'PRODUCTO_NO_ENCONTRADO',
    });
  });

  test('eliminar el último deja items [] y total 0', async () => {
    repo.removeItem.mockResolvedValue(true);
    repo.getAllItems.mockResolvedValue([]);

    expect(await service.removeItem('usr_1', 'prod_001')).toMatchObject({
      items: [],
      total: 0,
    });
  });
});

describe('HU-05: clearCart', () => {
  test('vacía y devuelve totales en 0 sin leer Redis ni Catálogo', async () => {
    repo.clearCart.mockResolvedValue();

    const cart = await service.clearCart('usr_1');

    expect(repo.clearCart).toHaveBeenCalledWith('usr_1');
    expect(repo.getAllItems).not.toHaveBeenCalled();
    expect(catalog.getProduct).not.toHaveBeenCalled();
    expect(cart).toMatchObject({
      userId: 'usr_1',
      items: [],
      subtotal: 0,
      descuentoTotal: 0,
      total: 0,
    });
  });
});