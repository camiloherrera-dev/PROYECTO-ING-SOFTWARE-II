<script setup>
import { useCheckoutStore } from '../stores/checkoutStore';
import { money } from '../utils/money';

// HU-10: pantalla de pedido confirmado
const co = useCheckoutStore();
const fecha = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
</script>

<template>
  <section>
    <h2>¡Pedido confirmado!</h2>
    <p>Número de pedido: <strong>{{ co.pedido.pedidoId }}</strong></p>
    <p>Fecha: {{ fecha(co.pedido.creadoEn) }}</p>
    <ul>
      <li v-for="item in co.pedido.items" :key="item.productId">
        {{ item.nombre }} × {{ item.cantidad }} — {{ money(item.totalItem) }}
      </li>
    </ul>
    <p v-if="co.pedido.descuentoTotal > 0" class="desc">Ahorraste {{ money(co.pedido.descuentoTotal) }}</p>
    <p class="total">Total pagado: {{ money(co.pedido.total) }}</p>
    <button @click="co.seguirComprando()">Seguir comprando</button>
  </section>
</template>

<style scoped>
li { list-style: none; }
.desc { color: #1b7f3b; }
.total { font-weight: 700; font-size: 1.2rem; }
</style>