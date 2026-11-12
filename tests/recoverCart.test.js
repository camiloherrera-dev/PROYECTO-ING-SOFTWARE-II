const request = require('supertest');

// Doble explícito del repositorio: incluye las tres funciones de actividad (PR de Jeisson),
// así estas pruebas no dependen de ese PR.
jest.mock('../src/repositories/cartRepository', () => ({
  getItem: jest.fn(), saveItem: jest.fn(), addItem: jest.fn(), getAllItems: jest.fn(),
  removeItem: jest.fn(), clearCart: jest.fn(),
  touchActividad: jest.fn(), getActividad: jest.fn(), getTtl: jest.fn(),
}));
jest.mock('../src/clients/catalogClient', () => ({ getProduct: jest.fn() }));
jest.mock('../src/discounts/discountRules', () => ({ getActiveRules: async () => [] }));

const repo = require('../src/repositories/cartRepository');
const catalog = require('../src/clients/catalogClient');
const AppError = require('../src/errors/AppError');
const service = require('../src/services/cartService');
const app = require('../src/app');
const { makeToken } = require('./helpers/token');

const AHORA = Date.parse('2026-11-10T15:00:00.000Z');
const hace = (min) => new Date(AHORA - min * 60000).toISOString();
const enRedis = (productId, precioUnitario, cantidad = 2) => ({ productId, nombre: productId, precioUnitario, cantidad });
const producto = (productId, precio, activo = true) => ({ productId, nombre: productId, precio, activo, stock: 10 });
const auth = (u = 'usr_1') => ({ Authorization: `Bearer ${makeToken(u)}` });

beforeEach(() => {
  jest.resetAllMocks();
  // Solo se falsea Date: los temporizadores reales siguen (supertest y el timeout de Descuentos los usan)
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'nextTick'] });
  jest.setSystemTime(AHORA);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  repo.getTtl.mockResolvedValue(604000);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

describe('HU-12: recoverCart', () => {
  test('con 3 horas sin actividad: inactivo, con el tiempo y la expiración', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.getActividad.mockResolvedValue(hace(185));
    const r = await service.recoverCart('u1');
    expect(r.recuperacion).toMatchObject({
      hayCarrito: true, inactivo: true, ultimaActividad: hace(185), inactividadMinutos: 185, expiraEnSegundos: 604000,
    });
    expect(r.items).toHaveLength(1);
    expect(repo.touchActividad).toHaveBeenCalledWith('u1');
  });

  test('con actividad reciente (10 min) no está inactivo', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.getActividad.mockResolvedValue(hace(10));
    expect((await service.recoverCart('u1')).recuperacion.inactivo).toBe(false);
  });

  test('justo en el umbral (60 min) ya cuenta como inactivo', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.getActividad.mockResolvedValue(hace(60));
    expect((await service.recoverCart('u1')).recuperacion.inactivo).toBe(true);
  });

  test('informa los precios que cambiaron con el precio anterior', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 120));
    repo.getActividad.mockResolvedValue(hace(10));
    const { recuperacion } = await service.recoverCart('u1');
    expect(recuperacion.cambios.preciosCambiados).toEqual([
      { productId: 'p1', nombre: 'p1', precioAnterior: 100, precioUnitario: 120 },
    ]);
    expect(recuperacion.cambios.noDisponibles).toEqual([]);
  });

  test('informa los productos que ya no están disponibles', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100), enRedis('p3', 50)]);
    catalog.getProduct.mockImplementation(async (id) => (id === 'p1' ? producto('p1', 100) : producto('p3', 50, false)));
    repo.getActividad.mockResolvedValue(hace(10));
    const { recuperacion } = await service.recoverCart('u1');
    expect(recuperacion.cambios.noDisponibles).toEqual([{ productId: 'p3', nombre: 'p3' }]);
  });

  test('carrito vacío o vencido: hayCarrito false y no registra actividad', async () => {
    repo.getAllItems.mockResolvedValue([]);
    repo.getActividad.mockResolvedValue(null);
    repo.getTtl.mockResolvedValue(null);
    const r = await service.recoverCart('u1');
    expect(r.recuperacion).toMatchObject({ hayCarrito: false, inactivo: false, expiraEnSegundos: null });
    expect(r.items).toEqual([]);
    expect(repo.touchActividad).not.toHaveBeenCalled();
  });

  test('carrito anterior a la función (sin registro de actividad): no está inactivo y empieza a registrarse', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.getActividad.mockResolvedValue(null);
    const r = await service.recoverCart('u1');
    expect(r.recuperacion).toMatchObject({ inactivo: false, ultimaActividad: null, inactividadMinutos: 0 });
    expect(repo.touchActividad).toHaveBeenCalledWith('u1');
  });

  test('si Catálogo cae responde 503 y no registra actividad', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockRejectedValue(new AppError(503, 'CATALOGO_NO_DISPONIBLE', 'caído'));
    await expect(service.recoverCart('u1')).rejects.toMatchObject({ status: 503 });
    expect(repo.touchActividad).not.toHaveBeenCalled();
  });

  test('si registrar la visita falla, igual responde el carrito', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.getActividad.mockResolvedValue(hace(185));
    repo.touchActividad.mockRejectedValue(new Error('Redis lento'));
    await expect(service.recoverCart('u1')).resolves.toMatchObject({ recuperacion: { inactivo: true } });
  });
});

describe('HU-12: las operaciones del cliente registran actividad', () => {
  test('addItem', async () => {
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.addItem.mockResolvedValue({ created: true });
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100, 1)]);
    await service.addItem('u1', 'p1', 1);
    expect(repo.touchActividad).toHaveBeenCalledWith('u1');
  });

  test('updateQuantity', async () => {
    repo.getItem.mockResolvedValue(enRedis('p1', 100));
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100, 3)]);
    await service.updateQuantity('u1', 'p1', 3);
    expect(repo.touchActividad).toHaveBeenCalledWith('u1');
  });

  test('removeItem', async () => {
    repo.removeItem.mockResolvedValue(true);
    repo.getAllItems.mockResolvedValue([]);
    await service.removeItem('u1', 'p1');
    expect(repo.touchActividad).toHaveBeenCalledWith('u1');
  });

  test('removeItem de un producto ausente (404) no registra actividad', async () => {
    repo.removeItem.mockResolvedValue(false);
    await expect(service.removeItem('u1', 'p1')).rejects.toMatchObject({ status: 404 });
    expect(repo.touchActividad).not.toHaveBeenCalled();
  });

  test('getCart no registra actividad (es una revalidación automática)', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    await service.getCart('u1');
    expect(repo.touchActividad).not.toHaveBeenCalled();
  });

  test('si registrar la actividad falla, la operación igual termina bien', async () => {
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.addItem.mockResolvedValue({ created: true });
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100, 1)]);
    repo.touchActividad.mockRejectedValue(new Error('Redis lento'));
    await expect(service.addItem('u1', 'p1', 1)).resolves.toMatchObject({ created: true });
  });
});

describe('GET /api/carrito/recuperar (HU-12)', () => {
  test('200 con el carrito y el bloque recuperacion; el userId sale del token', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockResolvedValue(producto('p1', 100));
    repo.getActividad.mockResolvedValue(hace(185));
    const res = await request(app).get('/api/carrito/recuperar').set(auth('usr_demo'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: 'usr_demo',
      recuperacion: { hayCarrito: true, inactivo: true, inactividadMinutos: 185, expiraEnSegundos: 604000 },
    });
    expect(repo.getAllItems).toHaveBeenCalledWith('usr_demo');
  });

  test('sin token responde 401', async () => {
    const res = await request(app).get('/api/carrito/recuperar');
    expect(res.status).toBe(401);
    expect(repo.getAllItems).not.toHaveBeenCalled();
  });

  test('con Catálogo caído responde 503', async () => {
    repo.getAllItems.mockResolvedValue([enRedis('p1', 100)]);
    catalog.getProduct.mockRejectedValue(new AppError(503, 'CATALOGO_NO_DISPONIBLE', 'caído'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/carrito/recuperar').set(auth());
    expect(res.status).toBe(503);
    expect(res.body.codigo).toBe('CATALOGO_NO_DISPONIBLE');
  });
});
