import { defineStore } from 'pinia';
import * as api from '../api/cartApi';

const EMPTY = { items: [], subtotal: 0, descuentoTotal: 0, total: 0 };

export const useCartStore = defineStore('cart', {
  state: () => ({ cart: { ...EMPTY }, loading: false, error: null }),
  getters: {
    totalItems: (s) => s.cart.items.reduce((n, i) => n + i.cantidad, 0), // contador del ícono
  },
  actions: {
    load() { return this._run(() => api.getCart()); },
    add(productId, cantidad = 1) { return this._run(() => api.addItem(productId, cantidad)); },
    setQuantity(productId, cantidad) { return this._run(() => api.updateQuantity(productId, cantidad)); },
    async _run(call) {
      this.loading = true;
      this.error = null;
      try {
        this.cart = await call(); // POST/PUT/GET devuelven el carrito completo
      } catch (e) {
        this.error = e.mensaje || 'Ocurrió un error inesperado';
      } finally {
        this.loading = false;
      }
    },
  },
});