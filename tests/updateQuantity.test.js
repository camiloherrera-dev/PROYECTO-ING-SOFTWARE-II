const request = require('supertest');
const { makeToken } = require('./helpers/token');

jest.mock('../src/repositories/cartRepository', () => ({
  getItem: jest.fn(),
  getAllItems: jest.fn(),
  saveItem: jest.fn(),
}));
jest.mock('../src/clients/catalogClient', () => ({
  getProduct: jest.fn(),
}));

const app = require('../src/app');
const repository = require('../src/repositories/cartRepository');
const catalogClient = require('../src/clients/catalogClient');

const auth = (userId = 'usr_1') => ({ Authorization: `Bearer ${makeToken(userId)}` });
const item = (productId, cantidad, precioUnitario = 100, extra = {}) => ({
  productId,
  nombre: productId,
  precioUnitario,
  cantidad,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('cantidad válida reemplaza y devuelve total recalculado', async () => {
  repository.getItem.mockResolvedValue(item('prod_001', 2));
  repository.getAllItems.mockResolvedValue([item('prod_001', 5)]);

  const res = await request(app)
    .put('/api/carrito/items/prod_001')
    .set(auth())
    .send({ cantidad: 5 });

  expect(res.status).toBe(200);
  expect(repository.saveItem).toHaveBeenCalledWith('usr_1', item('prod_001', 5));
  expect(res.body.total).toBe(500);
});

test('reemplaza la cantidad, no la suma', async () => {
  repository.getItem.mockResolvedValue(item('prod_001', 2));
  repository.getAllItems.mockResolvedValue([item('prod_001', 5)]);

  await request(app)
    .put('/api/carrito/items/prod_001')
    .set(auth())
    .send({ cantidad: 5 });

  expect(repository.saveItem).toHaveBeenCalledWith('usr_1', expect.objectContaining({ cantidad: 5 }));
  expect(repository.saveItem).not.toHaveBeenCalledWith('usr_1', expect.objectContaining({ cantidad: 7 }));
});

test.each([0, -2, 1.5, '3'])('cantidad inválida %p responde 400 y no guarda', async (cantidad) => {
  const res = await request(app)
    .put('/api/carrito/items/prod_001')
    .set(auth())
    .send({ cantidad });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    codigo: 'VALIDACION_FALLIDA',
    mensaje: expect.any(String),
  });
  expect(repository.saveItem).not.toHaveBeenCalled();
});

test('producto que no está en el carrito responde 404', async () => {
  repository.getItem.mockResolvedValue(null);

  const res = await request(app)
    .put('/api/carrito/items/prod_999')
    .set(auth())
    .send({ cantidad: 5 });

  expect(res.status).toBe(404);
  expect(res.body).toEqual({
    codigo: 'PRODUCTO_NO_ENCONTRADO',
    mensaje: 'El producto no está en el carrito',
  });
});

test('no llama a catalogClient.getProduct', async () => {
  repository.getItem.mockResolvedValue(item('prod_001', 2));
  repository.getAllItems.mockResolvedValue([item('prod_001', 5)]);

  await request(app)
    .put('/api/carrito/items/prod_001')
    .set(auth())
    .send({ cantidad: 5 });

  expect(catalogClient.getProduct).not.toHaveBeenCalled();
});

test('sin token responde 401', async () => {
  const res = await request(app)
    .put('/api/carrito/items/prod_001')
    .send({ cantidad: 5 });

  expect(res.status).toBe(401);
  expect(res.body.codigo).toBe('NO_AUTORIZADO');
});

test('con varios ítems solo cambia el indicado y el total suma todos', async () => {
  repository.getItem.mockResolvedValue(item('prod_001', 2, 100, { precioAnterior: 120 }));
  repository.getAllItems.mockResolvedValue([
    item('prod_001', 5, 100, { precioAnterior: 120 }),
    item('prod_002', 3, 50),
  ]);

  const res = await request(app)
    .put('/api/carrito/items/prod_001')
    .set(auth())
    .send({ cantidad: 5 });

  expect(res.status).toBe(200);
  expect(repository.saveItem).toHaveBeenCalledWith(
    'usr_1',
    item('prod_001', 5, 100, { precioAnterior: 120 }),
  );
  expect(res.body.items).toHaveLength(2);
  expect(res.body.items[0].cantidad).toBe(5);
  expect(res.body.items[1].cantidad).toBe(3);
  expect(res.body.total).toBe(650);
});

test('sin body responde 400 y no guarda', async () => {
  const res = await request(app)
    .put('/api/carrito/items/prod_001')
    .set(auth());

  expect(res.status).toBe(400);
  expect(res.body.codigo).toBe('VALIDACION_FALLIDA');
  expect(repository.saveItem).not.toHaveBeenCalled();
});