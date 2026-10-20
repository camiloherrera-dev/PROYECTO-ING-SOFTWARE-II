<script setup>
import AddToCartButton from './AddToCartButton.vue';

const productos = [
  { id: 'prod_001', nombre: 'Camiseta básica algodón' },
  { id: 'prod_002', nombre: 'Jean clásico' },
  { id: 'prod_003', nombre: 'Gorra edición limitada (inactivo en Catálogo)' },
];
</script>

<template>
  <ul>
    <li v-for="p in productos" :key="p.id">
      {{ p.nombre }} <AddToCartButton :product-id="p.id" />
    </li>
  </ul>
</template>