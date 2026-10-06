<script setup>
import { ref } from 'vue';
import { useCartStore } from '../stores/cartStore';

const props = defineProps({ productId: { type: String, required: true } });
const cart = useCartStore();
const feedback = ref('');

async function onAdd() {
  await cart.add(props.productId, 1); // POST /api/carrito/items con el JWT en el header
  feedback.value = cart.error ? cart.error : 'Producto agregado al carrito';
  setTimeout(() => (feedback.value = ''), 2500);
}
</script>

<template>
  <span>
    <button :disabled="cart.loading" @click="onAdd">Agregar al carrito</button>
    <small v-if="feedback"> {{ feedback }}</small>
  </span>
</template>