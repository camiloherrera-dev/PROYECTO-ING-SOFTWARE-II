<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useCheckoutStore } from '../stores/checkoutStore';
import { money } from '../utils/money';
import CartSummary from './CartSummary.vue';

// HU-08: resumen congelado · HU-10: confirmar
const co = useCheckoutStore();

const ahora = ref(Date.now());
let timer;
onMounted(() => { timer = setInterval(() => { ahora.value = Date.now(); }, 1000); });
onUnmounted(() => clearInterval(timer));

const restante = computed(() => Math.max(0, Date.parse(co.checkout.expiraEn) - ahora.value));
const vencido = computed(() => restante.value === 0 || co.checkout.vencido);
const reloj = computed(() => {
  const s = Math.floor(restante.value / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
const horaVence = computed(() => new Date(co.checkout.expiraEn)
  .toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
</script>

<template>
  <section>
    <h2>Resumen de tu compra</h2>
    <p v-if="!vencido">Precios reservados hasta las {{ horaVence }} (quedan {{ reloj }}).</p>
    <p v-else class="vencido" role="alert">Tu resumen venció. Vuelve al carrito para verificar de nuevo.</p>

    <ul>
      <li v-for="item in co.checkout.items" :key="item.productId">
        <strong>{{ item.nombre }}</strong> × {{ item.cantidad }}
        <span v-if="item.descuentoAplicadoItem > 0" class="desc">(− {{ money(item.descuentoAplicadoItem) }})</span>
        — {{ money(item.totalItem) }}
      </li>
    </ul>

    <CartSummary :resumen="co.checkout" />

    <p v-if="co.error" role="alert">{{ co.error }}</p>

    <div class="acciones">
      <button :disabled="co.loading" @click="co.volverAlCarrito()">Volver al carrito</button>
      <!-- Deshabilitado mientras la petición está en curso: evita el doble clic -->
      <button class="confirmar" :disabled="co.loading || vencido" @click="co.confirm()">
        {{ co.loading ? 'Confirmando…' : 'Confirmar pedido' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
li { list-style: none; margin-bottom: 0.5rem; }
.desc { color: #1b7f3b; }
.vencido, [role='alert'] { color: #b00020; }
.acciones { display: flex; gap: 1rem; margin-top: 1rem; }
.confirmar { font-weight: 700; padding: 0.6rem 1.2rem; }
</style>