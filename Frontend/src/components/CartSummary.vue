<script setup>
import { computed } from 'vue';
import { useCartStore } from '../stores/cartStore';
import { money } from '../utils/money';

// Sprint 3: sin prop muestra el carrito; con :resumen muestra el snapshot del checkout
const props = defineProps({ resumen: { type: Object, default: null } });
const cart = useCartStore();
const r = computed(() => props.resumen || cart.cart);
const descuentoCarrito = computed(() => (r.value.descuentosAplicados || []).find((d) => d.productId === null) || null);
</script>

<template>
  <aside class="resumen">
    <p v-if="!r.descuentosDisponibles" class="aviso" role="status">
      Los descuentos no están disponibles en este momento. Se muestra el precio sin descuentos.
    </p>
    <dl>
      <dt>Subtotal</dt>
      <dd>{{ money(r.subtotal) }}</dd>

      <template v-if="r.descuentoItems > 0">
        <dt>Descuentos en productos</dt>
        <dd class="desc">− {{ money(r.descuentoItems) }}</dd>
      </template>

      <template v-if="descuentoCarrito">
        <dt>{{ descuentoCarrito.descripcion }}</dt>
        <dd class="desc">− {{ money(descuentoCarrito.monto) }}</dd>
      </template>

      <dt>Total descuentos</dt>
      <dd class="desc">− {{ money(r.descuentoTotal) }}</dd>

      <dt class="total">Total</dt>
      <dd class="total">{{ money(r.total) }}</dd>
    </dl>
  </aside>
</template>

<style scoped>
.aviso { background: #fff4e5; border-left: 4px solid #e8a33d; padding: 0.5rem 0.75rem; }
dl { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 1rem; }
dd { margin: 0; text-align: right; }
.desc { color: #1b7f3b; }
.total { font-weight: 700; font-size: 1.1rem; }
</style>