const historyRepository = require('../repositories/historyRepository');
const checkoutRepository = require('../repositories/checkoutRepository');
const AppError = require('../errors/AppError');
const LIMITE_POR_DEFECTO = 10;
const LIMITE_MAXIMO = 50;

function entero(valor, nombre, { minimo, maximo, porDefecto }) {
  if (valor === undefined) return porDefecto;
  const n = Number(valor);
  if (typeof valor !== 'string' || !/^\d+$/.test(valor) || n < minimo || n > maximo) {
    throw new AppError(400, 'VALIDACION_FALLIDA', `${nombre} debe ser un entero entre ${minimo} y ${maximo}`);
  }
  return n;
}

const resumen = (p) => ({
  pedidoId: p.pedidoId,
  checkoutId: p.checkoutId,
  estado: p.estado,
  creadoEn: p.creadoEn,
  unidades: (p.items || []).reduce((n, i) => n + i.cantidad, 0),
  subtotal: p.subtotal,
  descuentoTotal: p.descuentoTotal,
  total: p.total,
});

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

  async function listOrders(userId, query = {}) {
    const limit = entero(query.limit, 'limit', { minimo: 1, maximo: LIMITE_MAXIMO, porDefecto: LIMITE_POR_DEFECTO });
    const offset = entero(query.offset, 'offset', { minimo: 0, maximo: 1000000, porDefecto: 0 });
    try {
      const { total, pedidos } = await history.listPedidos(userId, { limit, offset });
      return { pedidos, total, limit, offset, fuente: 'POSTGRES' };
    } catch (e) {
      console.warn('Histórico en PostgreSQL no disponible, se usa el respaldo de Redis:', e.message);
      const { total, pedidos } = await checkouts.listPedidosRecientes(userId, limit, offset);
      return { pedidos: pedidos.map(resumen), total, limit, offset, fuente: 'REDIS' };
    }
  }

  async function getOrder(userId, pedidoId) {
    let pedido = null;
    try {
      pedido = await history.getPedido(userId, pedidoId);
    } catch (e) {
      console.warn('Histórico en PostgreSQL no disponible, se busca en Redis:', e.message);
    }
    if (!pedido) {
      const enRedis = await checkouts.getPedido(pedidoId);
      if (enRedis && enRedis.userId === userId) pedido = enRedis;
    }
    if (!pedido) throw new AppError(404, 'PEDIDO_NO_ENCONTRADO', 'El pedido no existe');
    return pedido;
  }

  return { recordOrder, listOrders, getOrder };
}

module.exports = { ...createHistoryService(), createHistoryService };