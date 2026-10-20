import { defineStore } from 'pinia';
import * as api from '../api/cartApi';

const EMPTY = {
  items: [], subtotal: 0, descuentoItems: 0, descuentoCarrito: 0,
  descuentoTotal: 0, total: 0,
  descuentosAplicados: [], descuentosDisponibles: true,
};

export const useCartStore = defineStore('cart', {
  state: () => ({ cart: { ...EMPTY }, loading: false, error: null }),
  getters: {
    totalItems: (s) => s.cart.items.reduce((n, i) => n + i.cantidad, 0),
    isEmpty: (s) => s.cart.items.length === 0,
    descuentoCarrito: (s) => s.cart.descuentosAplicados.find((d) => d.productId === null) || null,
    reglasDe: (s) => (productId) => s.cart.descuentosAplicados.filter((d) => d.productId === productId),
  },
  actions: {
    load() { return this._run(() => api.getCart()); },
    add(productId, cantidad = 1) { return this._run(() => api.addItem(productId, cantidad)); },
    setQuantity(productId, cantidad) { return this._run(() => api.updateQuantity(productId, cantidad)); },
    remove(productId) { return this._run(() => api.removeItem(productId)); }, // HU-04
    clear() { return this._run(() => api.clearCart()); },                      // HU-05
    async _run(call) {
      this.loading = true;
      this.error = null;
      try {
        // { ...EMPTY, ...} protege la vista si el backend aún no envía los campos nuevos
        this.cart = { ...EMPTY, ...(await call()) };
      } catch (e) {
        this.error = e.mensaje || 'Ocurrió un error inesperado';
      } finally {
        this.loading = false;
      }
    },
  },
});