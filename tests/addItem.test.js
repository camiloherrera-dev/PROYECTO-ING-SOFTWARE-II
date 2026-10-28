jest.mock('../src/repositories/cartRepository', () => ({
  getItem: jest.fn(),
  getAllItems: jest.fn(),
  saveItem: jest.fn(),
  addItem: jest.fn(),
}));
jest.mock('../src/clients/catalogClient', () => ({ getProduct: jest.fn() }));
// Cuando exista src/discounts/ (Jose David) agregar:
// jest.mock('../src/discounts/discountRules', () => ({ getActiveRules: async () => [] }));

const repo = require('../src/repositories/cartRepository');
const catalog = require('../src/clients/catalogClient');
const service = require('../src/services/cartService');

const camiseta = { productId: 'prod_001', nombre: 'Camiseta', precio: 49900, activo: true };
const enRedis = (cantidad) => ({ productId: 'prod_001', nombre: 'Camiseta', precioUnitario: 49900, cantidad });

beforeEach(() => jest.resetAllMocks());

test('producto nuevo: guarda con el precio de Catálogo y created=true', async () => {
  catalog.getProduct.mockResolvedValue(camiseta);
  repo.addItem.mockResolvedValue({ created: true });
  repo.getAllItems.mockResolvedValue([enRedis(2)]);
  const { created, cart } = await service.addItem('usr_1', 'prod_001', 2);
  expect(created).toBe(true);
  expect(repo.addItem).toHaveBeenCalledWith('usr_1', {
    productId: 'prod_001', nombre: 'Camiseta', precioUnitario: 49900, cantidad: 2,
  });
  expect(cart.subtotal).toBe(99800);
});

test('producto existente: created=false (la suma la hace Redis de forma atómica)', async () => {
  catalog.getProduct.mockResolvedValue(camiseta);
  repo.addItem.mockResolvedValue({ created: false });
  repo.getAllItems.mockResolvedValue([enRedis(5)]);
  const { created, cart } = await service.addItem('usr_1', 'prod_001', 3);
  expect(created).toBe(false);
  expect(cart.items[0].cantidad).toBe(5);
  expect(repo.saveItem).not.toHaveBeenCalled();
});

test('producto inactivo o inexistente: 404 y no guarda nada', async () => {
  catalog.getProduct.mockResolvedValueOnce({ ...camiseta, activo: false });
  await expect(service.addItem('usr_1', 'prod_003', 1))
    .rejects.toMatchObject({ status: 404, codigo: 'PRODUCTO_NO_ENCONTRADO' });
  catalog.getProduct.mockResolvedValueOnce(null);
  await expect(service.addItem('usr_1', 'prod_999', 1)).rejects.toMatchObject({ status: 404 });
  expect(repo.addItem).not.toHaveBeenCalled();
});

test.each([0, -1, 1.5, '2', null])('cantidad inválida (%p): 400 sin consultar Catálogo', async (cantidad) => {
  await expect(service.addItem('usr_1', 'prod_001', cantidad))
    .rejects.toMatchObject({ status: 400, codigo: 'VALIDACION_FALLIDA' });
  expect(catalog.getProduct).not.toHaveBeenCalled();
});

test.each(['', ' ', undefined, 42])('productId inválido (%p): 400', async (productId) => {
  await expect(service.addItem('usr_1', productId, 1)).rejects.toMatchObject({ status: 400 });
  expect(catalog.getProduct).not.toHaveBeenCalled();
});
