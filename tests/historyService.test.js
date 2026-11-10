const { createHistoryService } = require('../src/services/historyService');
const AppError = require('../src/errors/AppError');

describe('historyService', () => {
  test('listOrders usa Postgres y si falla hace fallback a Redis', async () => {
    const historyRepo = {
      listPedidos: jest.fn().mockRejectedValue(new Error('DB down')),
    };
    const checkoutRepo = {
      listPedidosRecientes: jest.fn().mockResolvedValue({
        total: 1,
        pedidos: [{ pedidoId: 'ped_1', subtotal: 100, descuentoTotal: 0, total: 100, items: [] }],
      }),
    };
    const service = createHistoryService({ history: historyRepo, checkouts: checkoutRepo });
    const res = await service.listOrders('usr_1', {});
    expect(res.fuente).toBe('REDIS');
    expect(res.pedidos.length).toBe(1);
  });

  test('getOrder lanza 404 si no existe en Postgres ni en Redis', async () => {
    const historyRepo = {
      getPedido: jest.fn().mockResolvedValue(null),
    };
    const checkoutRepo = {
      getPedido: jest.fn().mockResolvedValue(null),
    };
    const service = createHistoryService({ history: historyRepo, checkouts: checkoutRepo });
    await expect(service.getOrder('usr_1', 'ped_999')).rejects.toThrow(AppError);
  });
});