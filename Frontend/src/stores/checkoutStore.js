import { defineStore } from 'pinia';
import * as api from '../api/cartApi';
import { useCartStore } from './cartStore';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Sprint 3: flujo carrito → checkout → pedido (HU-08, HU-09, HU-10)
export const useCheckoutStore = defineStore('checkout', {
  state: () => ({
    paso: 'carrito',        // 'carrito' | 'checkout' | 'pedido'
    disponibilidad: null,   // última respuesta de GET /disponibilidad (o los items de un 409)
    checkout: null,
    pedido: null,
    loading: false,
    error: null,
  }),
  getters: {
    estadoDe: (s) => (productId) => s.disponibilidad?.items?.find((i) => i.productId === productId) || null,
  },
  actions: {
    // HU-09: "Ir a pagar"
    async verify() {
      this.loading = true;
      this.error = null;
      try {
        this.disponibilidad = await api.checkAvailability();
        if (this.disponibilidad.disponible) {
          await this.startCheckout();
        } else {
          await useCartStore().load(); // PRECIO_CAMBIO ya actualizó precios en el backend
          this.error = 'Revisa los productos marcados antes de pagar.';
        }
      } catch (e) {
        this.error = e.mensaje;
      } finally {
        this.loading = false;
      }
    },

    // HU-08: congela el resumen
    async startCheckout() {
      try {
        this.checkout = await api.createCheckout();
        this.paso = 'checkout';
      } catch (e) {
        if (e.codigo === 'CARRITO_NO_DISPONIBLE') {
          this.disponibilidad = { disponible: false, items: e.items || [] };
          await useCartStore().load();
        }
        throw e;
      }
    },

    // HU-10: confirmar. Reintenta UNA vez si otra petición está confirmando.
    async confirm(reintento = false) {
      this.loading = true;
      this.error = null;
      try {
        this.pedido = await api.confirmCheckout(this.checkout.checkoutId);
        this.paso = 'pedido';
        await useCartStore().load(); // el carrito queda vacío
      } catch (e) {
        if (e.codigo === 'CONFIRMACION_EN_CURSO' && !reintento) {
          await esperar(1500);
          return this.confirm(true);
        }
        if (e.codigo === 'STOCK_INSUFICIENTE') {
          this.disponibilidad = {
            disponible: false,
            items: (e.items || []).map((i) => ({ ...i, estado: 'SIN_STOCK' })),
          };
          this.volverAlCarrito();
          this.error = 'Algunos productos se agotaron mientras pagabas. Revisa tu carrito.';
          await useCartStore().load();
          return;
        }
        if (e.codigo === 'CHECKOUT_EXPIRADO' || e.codigo === 'CHECKOUT_REEMPLAZADO') {
          this.error = 'Tu resumen venció. Vuelve a verificar tu carrito para continuar.';
          this.checkout = { ...this.checkout, vencido: true };
          return;
        }
        this.error = e.mensaje;
      } finally {
        this.loading = false;
      }
    },

    volverAlCarrito() {
      this.paso = 'carrito';
      this.checkout = null;
    },
    seguirComprando() {
      this.$reset();
    },
  },
});