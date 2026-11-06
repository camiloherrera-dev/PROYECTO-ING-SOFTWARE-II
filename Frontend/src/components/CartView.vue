<script setup>
import { onMounted } from 'vue';
import { useCartStore } from '../stores/cartStore';
import { useCheckoutStore } from '../stores/checkoutStore';
import { money } from '../utils/money';
import QuantityControl from './QuantityControl.vue';
import CartSummary from './CartSummary.vue';

const cart = useCartStore();
const co = useCheckoutStore(); // Sprint 3
onMounted(() => cart.load());

// HU-09: mensaje por ítem según la última verificación de disponibilidad
function avisoDisponibilidad(productId) {
  const d = co.estadoDe(productId);
  if (!d || d.estado === 'OK') return null;
  if (d.estado === 'SIN_STOCK') return `Sin stock suficiente (quedan ${d.stock}). Baja la cantidad o elimínalo.`;
  if (d.estado === 'INACTIVO') return 'Ya no está disponible. Elimínalo para continuar.';
  if (d.estado === 'PRECIO_CAMBIO') return `El precio cambió (antes ${money(d.precioAnterior)}). Revisa y vuelve a pagar.`;
  return null;
}

// HU-05: el backend no pide confirmación; la interfaz sí
function onClear() {
  if (window.confirm('¿Vaciar el carrito? Se eliminarán todos los productos.')) cart.clear();
}
</script>

<template>
  <section>
    <header class="cabecera">
      <h2>Mi carrito ({{ cart.totalItems }})</h2>
      <button v-if="!cart.isEmpty" class="vaciar" :disabled="cart.loading" @click="onClear">
        Vaciar carrito
      </button>
    </header>

    <p v-if="cart.loading">Cargando…</p>
    <p v-if="cart.error" role="alert">{{ cart.error }}</p>
    <p v-if="!cart.loading && cart.isEmpty">Tu carrito está vacío.</p>

    <ul>
      <li v-for="item in cart.cart.items" :key="item.productId" :class="{ agotado: !item.disponible }">
        <strong>{{ item.nombre }}</strong>
        <span v-if="!item.disponible"> — Producto no disponible (no se incluye en el total)</span>
        <span v-if="item.precioAnterior !== undefined">
          — El precio cambió (antes {{ money(item.precioAnterior) }})
        </span>
        <div v-if="avisoDisponibilidad(item.productId)" class="aviso-disp" role="status">
          {{ avisoDisponibilidad(item.productId) }}
        </div>
        <div>{{ money(item.precioUnitario) }} c/u</div>
        <QuantityControl
          :model-value="item.cantidad"
          :disabled="cart.loading || !item.disponible"
          @change="(q) => cart.setQuantity(item.productId, q)"
        />
        <div>Subtotal: {{ money(item.subtotalItem) }}</div>

        <!-- HU-06/HU-07: descuento del ítem, con la regla que lo produjo -->
        <div v-if="item.descuentoAplicadoItem > 0" class="desc">
          <span v-for="d in cart.reglasDe(item.productId)" :key="d.reglaId">
            {{ d.descripcion }}: </span>
          − {{ money(item.descuentoAplicadoItem) }} → {{ money(item.totalItem) }}
        </div>

        <!-- HU-04: también en ítems no disponibles, para poder quitarlos -->
        <button class="eliminar" :disabled="cart.loading" @click="cart.remove(item.productId)">Eliminar</button>
      </li>
    </ul>

    <CartSummary v-if="!cart.isEmpty" />

    <!-- HU-09 / HU-08: verificar y pasar al resumen de pago -->
    <p v-if="co.error" role="alert">{{ co.error }}</p>
    <button class="pagar" :disabled="cart.isEmpty || cart.loading || co.loading" @click="co.verify()">
      {{ co.loading ? 'Verificando…' : 'Ir a pagar' }}
    </button>
  </section>
</template>

<style scoped>
.cabecera { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.agotado { opacity: 0.55; background: #f3f3f3; }
li { margin-bottom: 1rem; list-style: none; }
.desc { color: #1b7f3b; }
.eliminar, .vaciar { color: #b00020; }
.aviso-disp { color: #8a4b00; font-weight: 600; }
.pagar { margin-top: 1rem; padding: 0.6rem 1.2rem; font-weight: 700; }
[role='alert'] { color: #b00020; }
</style>