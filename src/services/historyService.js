const historyRepository = require('../repositories/historyRepository');
const checkoutRepository = require('../repositories/checkoutRepository');

function createHistoryService({ history = historyRepository, checkouts = checkoutRepository } = {}) {
  async function recordOrder(pedido) {
    try {
      await history.savePedido(pedido);
      return true;
    } catch (e) {
      console.error(`No se pudo registrar el pedido ${pedido.pedidoId} en el histórico:`, e.message);
      return false;
    }
  }

  async function listOrders(userId, query) {
    const limit = Number(query.limit) || 10;
    const offset = Number(query.offset) || 0;
    try {
      const res = await history.listPedidos(userId, { limit, offset });
      return { fuente: 'POSTGRES', ...res };
    } catch (e) {
      // Fallback a Redis si PostgreSQL falla (RNF de disponibilidad)
      const res = await checkouts.listPedidosRecientes(userId, { limit, offset });
      return { fuente: 'REDIS', ...res };
    }
  }

  async function getOrder(userId, pedidoId) {
    let pedido = await history.getPedido(userId, pedidoId).catch(() => null);
    if (!pedido) {
      pedido = await checkouts.getPedido(pedidoId);
      if (!pedido || pedido.userId !== userId) {
        const AppError = require('../errors/AppError');
        throw new AppError(404, 'PEDIDO_NO_ENCONTRADO', 'El pedido no existe');
      }
    }
    return pedido;
  }

  return { recordOrder, listOrders, getOrder };
}

module.exports = { ...createHistoryService(), createHistoryService };