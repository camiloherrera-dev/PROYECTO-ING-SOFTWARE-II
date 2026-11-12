<script setup>
import { ref } from 'vue';
import ProductsDemo from './components/ProductsDemo.vue';
import CartView from './components/CartView.vue';
import CheckoutView from './components/CheckoutView.vue';
import PedidoConfirmado from './components/PedidoConfirmado.vue';
import PedidosView from './components/PedidosView.vue';
import { useCheckoutStore } from './stores/checkoutStore';
import { useOrdersStore } from './stores/ordersStore';

const co = useCheckoutStore(); // Sprint 3: decide qué paso del flujo se muestra
const orders = useOrdersStore();
const seccion = ref('tienda');

function ir(destino) {
  seccion.value = destino;
  if (destino === 'pedidos') orders.load(0);
}
</script>

<template>
  <main>
    <h1>Demo Carrito de Compras</h1>
    <nav class="menu" aria-label="Secciones de la tienda">
      <button type="button" :disabled="seccion === 'tienda'" @click="ir('tienda')">Tienda</button>
      <button type="button" :disabled="seccion === 'pedidos'" @click="ir('pedidos')">Mis pedidos</button>
    </nav>

    <PedidosView v-if="seccion === 'pedidos'" />
    <template v-else>
      <template v-if="co.paso === 'carrito'">
        <ProductsDemo />
        <CartView />
      </template>
      <CheckoutView v-else-if="co.paso === 'checkout'" />
      <PedidoConfirmado v-else-if="co.paso === 'pedido'" />
    </template>
  </main>
</template>

<style scoped>
.menu { display: flex; gap: .5rem; margin-bottom: 1rem; }
.menu button { padding: .55rem .9rem; color: #173c78; background: #fff; border: 1px solid #cbd5e1; border-radius: .5rem; cursor: pointer; }
.menu button:disabled { color: #fff; background: #173c78; border-color: #173c78; cursor: default; }
</style>
