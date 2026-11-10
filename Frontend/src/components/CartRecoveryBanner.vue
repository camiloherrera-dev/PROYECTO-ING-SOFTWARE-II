<script setup>
import { computed } from 'vue';
import { useCartStore } from '../stores/cartStore';
import { money } from '../utils/money';

// HU-12: aviso al volver después de un tiempo de inactividad o cuando algo cambió
const cart = useCartStore();
const r = computed(() => cart.recuperacion);
const cambios = computed(() => r.value?.cambios || { preciosCambiados: [], noDisponibles: [] });
const visible = computed(() => Boolean(r.value?.hayCarrito)
  && (r.value.inactivo || cambios.value.preciosCambiados.length > 0 || cambios.value.noDisponibles.length > 0));

const tiempo = computed(() => {
  const min = r.value?.inactividadMinutos || 0;
  if (min < 60) return `${min} minutos`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  return `${dias} ${dias === 1 ? 'día' : 'días'}`;
});
const diasRestantes = computed(() => Math.floor((r.value?.expiraEnSegundos || 0) / 86400));
</script>

<template>
  <aside v-if="visible" class="recuperado" role="status">
    <p v-if="r.inactivo">
      <strong>Recuperamos tu carrito.</strong>
      Lo dejaste hace {{ tiempo }} y se conserva {{ diasRestantes }} días más.
    </p>
    <ul v-if="cambios.preciosCambiados.length">
      <li v-for="c in cambios.preciosCambiados" :key="c.productId">
        {{ c.nombre }}: el precio cambió de {{ money(c.precioAnterior) }} a {{ money(c.precioUnitario) }}.
      </li>
    </ul>
    <ul v-if="cambios.noDisponibles.length">
      <li v-for="c in cambios.noDisponibles" :key="c.productId">
        {{ c.nombre }} ya no está disponible y no suma al total.
      </li>
    </ul>
    <button @click="cart.dismissRecovery()">Entendido</button>
  </aside>
</template>

<style scoped>
.recuperado { background: #eef6ff; border-left: 4px solid #2f7fd1; padding: 0.5rem 0.75rem; margin-bottom: 1rem; }
ul { margin: 0.25rem 0; padding-left: 1.25rem; }
</style>