<script setup>
import ProductsDemo from './components/ProductsDemo.vue';
import CartView from './components/CartView.vue';
import CheckoutView from './components/CheckoutView.vue';
import PedidoConfirmado from './components/PedidoConfirmado.vue';
import { useCheckoutStore } from './stores/checkoutStore';

const co = useCheckoutStore(); // Sprint 3: decide qué paso del flujo se muestra
</script>

<template>
  <main>
    <h1>Demo Carrito de Compras</h1>
    <template v-if="co.paso === 'carrito'">
      <ProductsDemo />
      <CartView />
    </template>
    <CheckoutView v-else-if="co.paso === 'checkout'" />
    <PedidoConfirmado v-else-if="co.paso === 'pedido'" />
  </main>
</template>