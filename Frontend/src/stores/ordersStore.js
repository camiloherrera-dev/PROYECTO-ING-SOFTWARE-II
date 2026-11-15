import { defineStore } from 'pinia';
import * as api from '../api/ordersApi';

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    pedidos: [],
    total: 0,
    limit: 5,
    offset: 0,
    fuente: null,
    detalle: null,
    loading: false,
    error: null,
  }),
  getters: {
    hayAnterior: (state) => state.offset > 0,
    hayMas: (state) => state.offset + state.limit < state.total,
  },
  actions: {
    async load(offset = this.offset) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.listOrders(this.limit, offset);
        this.pedidos = response.pedidos;
        this.total = response.total;
        this.limit = response.limit;
        this.offset = response.offset;
        this.fuente = response.fuente;
      } catch (error) {
        this.error = error?.mensaje || 'No fue posible cargar tus pedidos.';
      } finally {
        this.loading = false;
      }
    },
    siguiente() {
      return this.load(this.offset + this.limit);
    },
    anterior() {
      return this.load(Math.max(0, this.offset - this.limit));
    },
    async open(pedidoId) {
      this.loading = true;
      this.error = null;
      try {
        this.detalle = await api.getOrder(pedidoId);
      } catch (error) {
        this.error = error?.mensaje || 'No fue posible cargar el detalle del pedido.';
      } finally {
        this.loading = false;
      }
    },
    close() {
      this.detalle = null;
      this.error = null;
    },
  },
});
