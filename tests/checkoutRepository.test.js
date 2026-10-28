// Redis simulado: defineCommand debe estar en el mock porque se llama al cargar el módulo.
const mockMulti = {
  del: jest.fn().mockReturnThis(),
  hset: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  lpush: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};
const mockRedis = {
  defineCommand: jest.fn(),
  multi: () => mockMulti,
  hgetall: jest.fn(),
  hset: jest.fn(),
  get: jest.fn(),
  checkoutConfirm: jest.fn(),
};
jest.mock('../src/redis/redisClient', () => ({ redis: mockRedis }));

const repo = require('../src/repositories/checkoutRepository');

const snapshot = { checkoutId: 'chk_1', userId: 'usr_1', items: [], descuentosAplicados: [], total: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  mockMulti.exec.mockResolvedValue([]);
});

test('registra el script Lua checkoutConfirm al cargar el módulo', () => {
  jest.isolateModules(() => require('../src/repositories/checkoutRepository'));
  expect(mockRedis.defineCommand).toHaveBeenCalledWith('checkoutConfirm', expect.objectContaining({ numberOfKeys: 1 }));
});

test('saveCheckout guarda el Hash con TTL de 24 h y mueve el puntero del usuario', async () => {
  await repo.saveCheckout(snapshot);
  expect(mockMulti.del).toHaveBeenCalledWith('checkout:chk_1');
  expect(mockMulti.hset).toHaveBeenCalledWith('checkout:chk_1', 'data', JSON.stringify(snapshot), 'estado', 'PENDIENTE', 'userId', 'usr_1');
  expect(mockMulti.expire).toHaveBeenCalledWith('checkout:chk_1', 86400);
  expect(mockMulti.set).toHaveBeenCalledWith('checkout-usuario:usr_1', 'chk_1', 'EX', 86400);
});

test('getCheckout devuelve null si no existe', async () => {
  mockRedis.hgetall.mockResolvedValue({});
  expect(await repo.getCheckout('chk_x')).toBeNull();
});

test('getCheckout devuelve el snapshot igual a como entró (arreglos vacíos incluidos) + estado', async () => {
  mockRedis.hgetall.mockResolvedValue({ data: JSON.stringify(snapshot), estado: 'CONFIRMADO', pedidoId: 'ped_1' });
  const c = await repo.getCheckout('chk_1');
  expect(c).toEqual({ ...snapshot, estado: 'CONFIRMADO', pedidoId: 'ped_1' });
  expect(Array.isArray(c.descuentosAplicados)).toBe(true);
});

test('startConfirmation pasa ahora y el bloqueo al script y traduce la respuesta', async () => {
  mockRedis.checkoutConfirm.mockResolvedValue(['ADQUIRIDO', '']);
  expect(await repo.startConfirmation('chk_1')).toEqual({ estado: 'ADQUIRIDO', pedidoId: undefined });
  expect(mockRedis.checkoutConfirm).toHaveBeenCalledWith('checkout:chk_1', expect.any(Number), 30000);
  mockRedis.checkoutConfirm.mockResolvedValue(['CONFIRMADO', 'ped_1']);
  expect(await repo.startConfirmation('chk_1')).toEqual({ estado: 'CONFIRMADO', pedidoId: 'ped_1' });
});

test('resetConfirmation devuelve el checkout a PENDIENTE', async () => {
  await repo.resetConfirmation('chk_1');
  expect(mockRedis.hset).toHaveBeenCalledWith('checkout:chk_1', 'estado', 'PENDIENTE');
});

test('savePedidoYConfirmar guarda el pedido y marca CONFIRMADO en el mismo MULTI', async () => {
  const pedido = { pedidoId: 'ped_1', userId: 'usr_1', total: 100 };
  await repo.savePedidoYConfirmar('chk_1', pedido);
  expect(mockMulti.set).toHaveBeenCalledWith('pedido:ped_1', JSON.stringify(pedido), 'EX', 2592000);
  expect(mockMulti.lpush).toHaveBeenCalledWith('pedidos-usuario:usr_1', 'ped_1');
  expect(mockMulti.hset).toHaveBeenCalledWith('checkout:chk_1', 'estado', 'CONFIRMADO', 'pedidoId', 'ped_1');
  expect(mockMulti.exec).toHaveBeenCalledTimes(1);
});

test('getActiveCheckoutId y getPedido leen sus claves', async () => {
  mockRedis.get.mockResolvedValueOnce('chk_1').mockResolvedValueOnce(JSON.stringify({ pedidoId: 'ped_1' })).mockResolvedValueOnce(null);
  expect(await repo.getActiveCheckoutId('usr_1')).toBe('chk_1');
  expect(mockRedis.get).toHaveBeenCalledWith('checkout-usuario:usr_1');
  expect(await repo.getPedido('ped_1')).toEqual({ pedidoId: 'ped_1' });
  expect(await repo.getPedido('ped_x')).toBeNull();
});
