<script setup>
import { onMounted } from 'vue';
import { useCartStore } from '../stores/cartStore';
import { money } from '../utils/money';
import QuantityControl from './QuantityControl.vue';
import CartSummary from './CartSummary.vue';

const cart = useCartStore();
onMounted(() => cart.load());

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
        <div>{{ money(item.precioUnitario) }} c/u</div>
        <QuantityControl
          :model-value="item.cantidad"
          :disabled="cart.loading || !item.disponible"
          @change="(q) => cart.setQuantity(item.productId, q)"
        />
        <div>Subtotal: {{ money(item.subtotalItem) }}</div>

        <!-- HU-06/HU-07: descuento del ítem, con la regla que lo produjo -->
        <div v-if="item.descuentoAplicadoItem > 0" class="desc">
          <span v-for="d in cart.reglasDe(item.productId)" :key="d.reglaId">{{ d.descripcion }}: </span>
          − {{ money(item.descuentoAplicadoItem) }} → {{ money(item.totalItem) }}
        </div>

        <!-- HU-04: también en ítems no disponibles, para poder quitarlos -->
        <button class="eliminar" :disabled="cart.loading" @click="cart.remove(item.productId)">Eliminar</button>
      </li>
    </ul>

    <CartSummary v-if="!cart.isEmpty" />
  </section>
</template>

<style scoped>
.cabecera { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.agotado { opacity: 0.55; background: #f3f3f3; }
li { margin-bottom: 1rem; list-style: none; }
.desc { color: #1b7f3b; }
.eliminar, .vaciar { color: #b00020; }
[role='alert'] { color: #b00020; }
</style>