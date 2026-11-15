import { request } from './cartApi';

// HU-11: historial y detalle de pedidos del usuario autenticado.
export const listOrders = (limit = 5, offset = 0) =>
  request(`/pedidos?limit=${limit}&offset=${offset}`);

export const getOrder = (pedidoId) =>
  request(`/pedidos/${encodeURIComponent(pedidoId)}`);
