const request = require('supertest');

// Mock explícito: en el stub actual getItem, getAllItems y saveItem son la misma
// función y el automock de Jest los volvería un único jest.fn compartido.
jest.mock('../src/repositories/cartRepository', () => ({
  getItem: jest.fn(),
  getAllItems: jest.fn(),
  saveItem: jest.fn(),
}));
jest.mock('../src/clients/catalogClient', () => ({ getProduct: jest.fn() }));
// Cuando exista src/discounts/ (Jose David) agregar:
// jest.mock('../src/discounts/discountRules', () => ({ getActiveRules: async () => [] }));

const repo = require('../src/repositories/cartRepository');
const catalog = require('../src/clients/catalogClient');
const AppError = require('../src/errors/AppError');
const app = require('../src/app');
const { makeToken } = require('./helpers/token');

const auth = (u = 'usr_1') => ({ Authorization: `Bearer ${makeToken(u)}` });
const camiseta = {
  productId: 'prod_001', nombre: 'Camiseta básica algodón', precioUnitario: 49900, cantidad: 2,
};
const producto = (precio = 49900, activo = true) => ({
  productId: 'prod_001', nombre: 'Camiseta básica algodón', precio, activo,
});

beforeEach(() => jest.resetAllMocks());

describe('GET /api/carrito (HU-02)', () => {
  test('carrito vacío → 200 con totales en 0 (ya no 501)', async () => {
    repo.getAllItems.mockResolvedValue([]);
    const res = await request(app).get('/api/carrito').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: 'usr_1', items: [], subtotal: 0, total: 0 });
    expect(catalog.getProduct).not.toHaveBeenCalled();
  });

  test('con ítems y precio sin cambios → 200 con desglose y sin escribir', async () => {
    repo.getAllItems.mockResolvedValue([camiseta]);
    catalog.getProduct.mockResolvedValue(producto());
    const res = await request(app).get('/api/carrito').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([expect.objectContaining({
      productId: 'prod_001', cantidad: 2, subtotalItem: 99800, totalItem: 99800, disponible: true,
    })]);
    expect(res.body.items[0]).not.toHaveProperty('precioAnterior');
    expect(res.body.total).toBe(99800);
    expect(repo.saveItem).not.toHaveBeenCalled();
  });

  test('precio cambiado en Catálogo → precioAnterior y Redis actualizado', async () => {
    repo.getAllItems.mockResolvedValue([camiseta]);
    catalog.getProduct.mockResolvedValue(producto(45000));
    const res = await request(app).get('/api/carrito').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ precioUnitario: 45000, precioAnterior: 49900 });
    expect(res.body.total).toBe(90000);
    expect(repo.saveItem).toHaveBeenCalledWith('usr_1', {
      productId: 'prod_001', nombre: 'Camiseta básica algodón', precioUnitario: 45000, cantidad: 2,
    });
  });

  test.each([
    ['inactivo', producto(49900, false)],
    ['eliminado (404 en Catálogo)', null],
  ])('producto %s → disponible: false y fuera del total', async (_caso, product) => {
    repo.getAllItems.mockResolvedValue([camiseta]);
    catalog.getProduct.mockResolvedValue(product);
    const res = await request(app).get('/api/carrito').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items[0].disponible).toBe(false);
    expect(res.body.total).toBe(0);
  });

  test('Catálogo caído → 503 CATALOGO_NO_DISPONIBLE sin escribir en Redis', async () => {
    repo.getAllItems.mockResolvedValue([camiseta]);
    catalog.getProduct.mockRejectedValue(
      new AppError(503, 'CATALOGO_NO_DISPONIBLE', 'No fue posible consultar el servicio de Catálogo'),
    );
    const res = await request(app).get('/api/carrito').set(auth());
    expect(res.status).toBe(503);
    expect(res.body.codigo).toBe('CATALOGO_NO_DISPONIBLE');
    expect(repo.saveItem).not.toHaveBeenCalled();
  });

  test('sin token → 401 NO_AUTORIZADO', async () => {
    const res = await request(app).get('/api/carrito');
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('NO_AUTORIZADO');
    expect(repo.getAllItems).not.toHaveBeenCalled();
  });

  test('el userId sale del token, no de la query (RNF-02)', async () => {
    repo.getAllItems.mockResolvedValue([]);
    const res = await request(app).get('/api/carrito?userId=usr_otro').set(auth('usr_1'));
    expect(res.status).toBe(200);
    expect(repo.getAllItems).toHaveBeenCalledWith('usr_1');
    expect(res.body.userId).toBe('usr_1');
  });
});
