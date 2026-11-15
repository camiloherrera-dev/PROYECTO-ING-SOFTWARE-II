// Redis simulado: defineCommand debe estar en el mock porque se llama al cargar el módulo.
const mockMulti = {
  hset: jest.fn().mockReturnThis(),
  hdel: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};
const mockRedis = {
  defineCommand: jest.fn(),
  multi: () => mockMulti,
  hget: jest.fn(),
  hgetall: jest.fn(),
  del: jest.fn(),
  cartAddItem: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  ttl: jest.fn(),
};
jest.mock('../src/redis/redisClient', () => ({ redis: mockRedis }));

const repo = require('../src/repositories/cartRepository');

beforeEach(() => {
  jest.clearAllMocks();
  mockMulti.exec.mockResolvedValue([[null, 1], [null, 1]]);
});

test('registra el script Lua de suma atómica al cargar el módulo', () => {
  jest.isolateModules(() => require('../src/repositories/cartRepository'));
  expect(mockRedis.defineCommand).toHaveBeenCalledWith('cartAddItem', expect.objectContaining({ numberOfKeys: 1 }));
});

test('saveItem guarda el JSON en carrito:{userId} y renueva el TTL', async () => {
  const item = { productId: 'prod_001', cantidad: 2 };
  await repo.saveItem('usr_1', item);
  expect(mockMulti.hset).toHaveBeenCalledWith('carrito:usr_1', 'prod_001', JSON.stringify(item));
  expect(mockMulti.expire).toHaveBeenCalledWith('carrito:usr_1', 604800);
});

test('addItem usa el script atómico y traduce 1 → created=true', async () => {
  mockRedis.cartAddItem.mockResolvedValue(1);
  const item = { productId: 'prod_001', nombre: 'Camiseta', precioUnitario: 49900, cantidad: 2 };
  expect(await repo.addItem('usr_1', item)).toEqual({ created: true });
  expect(mockRedis.cartAddItem).toHaveBeenCalledWith('carrito:usr_1', 'prod_001', JSON.stringify(item), 604800);
});

test('addItem con producto existente → created=false', async () => {
  mockRedis.cartAddItem.mockResolvedValue(0);
  expect(await repo.addItem('usr_1', { productId: 'prod_001', cantidad: 1 })).toEqual({ created: false });
});

test('getItem devuelve null si el producto no está en el carrito', async () => {
  mockRedis.hget.mockResolvedValue(null);
  expect(await repo.getItem('usr_1', 'prod_x')).toBeNull();
});

test('getAllItems devuelve [] si el carrito no existe y parsea los ítems', async () => {
  mockRedis.hgetall.mockResolvedValueOnce({});
  expect(await repo.getAllItems('usr_1')).toEqual([]);
  mockRedis.hgetall.mockResolvedValueOnce({ prod_001: JSON.stringify({ productId: 'prod_001', cantidad: 2 }) });
  expect(await repo.getAllItems('usr_1')).toEqual([{ productId: 'prod_001', cantidad: 2 }]);
});

test('removeItem: true si existía, false si no (HU-04)', async () => {
  expect(await repo.removeItem('usr_1', 'prod_001')).toBe(true);
  expect(mockMulti.hdel).toHaveBeenCalledWith('carrito:usr_1', 'prod_001');
  expect(mockMulti.expire).toHaveBeenCalledWith('carrito:usr_1', 604800);
  mockMulti.exec.mockResolvedValue([[null, 0], [null, 0]]);
  expect(await repo.removeItem('usr_1', 'prod_404')).toBe(false);
});

test('clearCart borra el carrito y su registro de actividad (HU-05)', async () => {
  await repo.clearCart('usr_1');
  expect(mockRedis.del).toHaveBeenCalledWith('carrito:usr_1', 'carrito-actividad:usr_1');
});

test('touchActividad guarda la fecha ISO con el TTL del carrito', async () => {
  await repo.touchActividad('usr_1');
  expect(mockRedis.set).toHaveBeenCalledWith(
    'carrito-actividad:usr_1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), 'EX', 604800);
});

test('getActividad devuelve la fecha guardada o null', async () => {
  mockRedis.get.mockResolvedValueOnce('2026-11-10T12:00:00.000Z').mockResolvedValueOnce(null);
  expect(await repo.getActividad('usr_1')).toBe('2026-11-10T12:00:00.000Z');
  expect(await repo.getActividad('usr_1')).toBeNull();
  expect(mockRedis.get).toHaveBeenCalledWith('carrito-actividad:usr_1');
});

test('getTtl devuelve los segundos restantes o null si el carrito no existe', async () => {
  mockRedis.ttl.mockResolvedValueOnce(600000).mockResolvedValueOnce(-2).mockResolvedValueOnce(-1);
  expect(await repo.getTtl('usr_1')).toBe(600000);
  expect(await repo.getTtl('usr_1')).toBeNull();
  expect(await repo.getTtl('usr_1')).toBeNull();
});