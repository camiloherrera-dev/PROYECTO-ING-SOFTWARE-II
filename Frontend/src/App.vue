<script setup>
import { ref } from 'vue';
import ProductsDemo from './components/ProductsDemo.vue';
import CartView from './components/CartView.vue';
import CheckoutView from './components/CheckoutView.vue';
import PedidoConfirmado from './components/PedidoConfirmado.vue';
import PedidosView from './components/PedidosView.vue';
import { useCheckoutStore } from './stores/checkoutStore';
import { useOrdersStore } from './stores/ordersStore';
import { useCartStore } from './stores/cartStore';
import { abrirEnPedidos, embebido, pedirLogin, tomarProductoAAgregar } from './hostApp';

const co = useCheckoutStore(); // Sprint 3: decide qué paso del flujo se muestra
const orders = useOrdersStore();
const cart = useCartStore();
const seccion = ref('tienda');
const sinSesion = embebido && !localStorage.getItem('token');

function ir(destino) {
  seccion.value = destino;
  if (destino === 'pedidos') orders.load(0);
}

// «Órdenes» en el Host App abre /carrito/pedidos.
if (abrirEnPedidos) ir('pedidos');

// «Agregar al carro» en Catálogo abre /carrito?agregar={id}: se agrega una unidad antes de mostrar
// el carrito, para que CartView lo cargue ya con el producto.
const porAgregar = tomarProductoAAgregar();
const agregando = ref(Boolean(porAgregar));
if (porAgregar) cart.add(porAgregar, 1).finally(() => { agregando.value = false; });
</script>

<template>
  <main>
    <!-- Dentro del Host App el encabezado lo pone el cascarón (contrato v1.2, requisito 3). -->
    <h1 v-if="!embebido">Demo Carrito de Compras</h1>
    <p v-if="sinSesion" class="aviso">
      Inicia sesión para ver tu carrito.
      <button type="button" @click="pedirLogin">Iniciar sesión</button>
    </p>
    <nav class="menu" aria-label="Secciones de la tienda">
      <button type="button" :disabled="seccion === 'tienda'" @click="ir('tienda')">Tienda</button>
      <button type="button" :disabled="seccion === 'pedidos'" @click="ir('pedidos')">Mis pedidos</button>
    </nav>

    <PedidosView v-if="seccion === 'pedidos'" />
    <p v-else-if="agregando">Agregando el producto…</p>
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
.aviso { display: flex; gap: .75rem; align-items: center; padding: .75rem 1rem; background: #fff7ed; border: 1px solid #fed7aa; border-radius: .5rem; }
.menu { display: flex; gap: .5rem; margin-bottom: 1rem; }
.menu button { padding: .55rem .9rem; color: #173c78; background: #fff; border: 1px solid #cbd5e1; border-radius: .5rem; cursor: pointer; }
.menu button:disabled { color: #fff; background: #173c78; border-color: #173c78; cursor: default; }
</style>
