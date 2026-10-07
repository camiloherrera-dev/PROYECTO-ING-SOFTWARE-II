<script setup>
import { onMounted } from 'vue';
import { useCartStore } from '../stores/cartStore';
import QuantityControl from './QuantityControl.vue';

const cart = useCartStore();
onMounted(() => cart.load()); // HU-02: se carga al entrar

const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
</script>

<template>
  <section>
    <h2>Mi carrito ({{ cart.totalItems }})</h2>

    <p v-if="cart.loading">Cargando…</p>
    <p v-if="cart.error" role="alert">{{ cart.error }}</p>
    <p v-if="!cart.loading && !cart.cart.items.length">Tu carrito está vacío.</p>

    <ul>
      <li v-for="item in cart.cart.items" :key="item.productId" :class="{ agotado: !item.disponible }">
        <strong>{{ item.nombre }}</strong>
        <span v-if="!item.disponible"> — Producto no disponible (no se incluye en el total)</span>
        <span v-if="item.precioAnterior !== undefined">
          — El precio cambió (antes {{ money(item.precioAnterior) }})
        </span>
        <div>{{ money(item.precioUnitario) }} c/u</div>
        <QuantityControl
          :model-value="item.cantidad"
          :disabled="cart.loading || !item.disponible"
          @change="(q) => cart.setQuantity(item.productId, q)"
        />
        <div>Subtotal: {{ money(item.subtotalItem) }}</div>
      </li>
    </ul>

    <dl>
      <dt>Subtotal</dt><dd>{{ money(cart.cart.subtotal) }}</dd>
      <dt>Descuentos</dt><dd>- {{ money(cart.cart.descuentoTotal) }}</dd>
      <dt>Total</dt><dd>{{ money(cart.cart.total) }}</dd>
    </dl>
  </section>
</template>

<style scoped>
.agotado { opacity: 0.55; background: #f3f3f3; }
li { margin-bottom: 1rem; list-style: none; }
[role='alert'] { color: #b00020; }
</style>