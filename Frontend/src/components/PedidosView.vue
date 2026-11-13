<script setup>
import { useOrdersStore } from '../stores/ordersStore';
import { money } from '../utils/money';

const orders = useOrdersStore();
const fecha = (iso) => new Date(iso).toLocaleString('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
</script>

<template>
  <section class="orders" aria-labelledby="orders-title">
    <template v-if="orders.detalle">
      <div class="orders-heading">
        <div>
          <p class="eyebrow">Detalle de compra</p>
          <h2 id="orders-title">Pedido {{ orders.detalle.pedidoId }}</h2>
          <p class="muted">{{ fecha(orders.detalle.creadoEn) }} · {{ orders.detalle.estado }}</p>
        </div>
        <button class="secondary" type="button" @click="orders.close()">
          Volver a mis pedidos
        </button>
      </div>

      <p v-if="orders.loading" class="muted" role="status">Cargando pedido…</p>
      <p v-if="orders.error" class="error" role="alert">{{ orders.error }}</p>

      <ul v-if="orders.detalle.items?.length" class="order-items">
        <li v-for="item in orders.detalle.items" :key="item.productId">
          <span>{{ item.nombre }} × {{ item.cantidad }}</span>
          <span>
            <small v-if="item.descuentoAplicadoItem > 0" class="discount">
              − {{ money(item.descuentoAplicadoItem) }}
            </small>
            {{ money(item.totalItem) }}
          </span>
        </li>
      </ul>

      <dl v-if="orders.detalle.items?.length" class="totals">
        <dt>Subtotal</dt><dd>{{ money(orders.detalle.subtotal) }}</dd>
        <dt>Descuentos</dt><dd class="discount">− {{ money(orders.detalle.descuentoTotal) }}</dd>
        <dt class="grand-total">Total pagado</dt>
        <dd class="grand-total">{{ money(orders.detalle.total) }}</dd>
      </dl>
    </template>

    <template v-else>
      <div class="orders-heading">
        <div>
          <p class="eyebrow">Tu cuenta</p>
          <h2 id="orders-title">Mis pedidos <span class="count">({{ orders.total }})</span></h2>
        </div>
      </div>

      <p v-if="orders.fuente === 'REDIS'" class="notice" role="status">
        Mostrando tus pedidos recientes: el historial completo no está disponible en este momento.
      </p>
      <p v-if="orders.loading" class="muted" role="status">Cargando pedidos…</p>
      <p v-if="orders.error" class="error" role="alert">{{ orders.error }}</p>
      <p v-if="!orders.loading && !orders.error && orders.pedidos.length === 0" class="empty">
        Todavía no tienes pedidos.
      </p>

      <div v-if="orders.pedidos.length" class="table-wrap">
        <table>
          <thead>
            <tr><th>Pedido</th><th>Fecha</th><th>Unidades</th><th>Total</th><th><span class="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="pedido in orders.pedidos" :key="pedido.pedidoId">
              <td class="order-id">{{ pedido.pedidoId }}</td>
              <td>{{ fecha(pedido.creadoEn) }}</td>
              <td>{{ pedido.unidades }}</td>
              <td>{{ money(pedido.total) }}</td>
              <td>
                <button class="view-button" type="button" :disabled="orders.loading" @click="orders.open(pedido.pedidoId)">
                  Ver detalle
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav v-if="orders.total > orders.limit" class="pagination" aria-label="Páginas del historial">
        <button class="secondary" type="button" :disabled="!orders.hayAnterior || orders.loading" @click="orders.anterior()">
          Anterior
        </button>
        <span class="muted">{{ orders.offset + 1 }}–{{ Math.min(orders.offset + orders.limit, orders.total) }} de {{ orders.total }}</span>
        <button class="secondary" type="button" :disabled="!orders.hayMas || orders.loading" @click="orders.siguiente()">
          Siguiente
        </button>
      </nav>
    </template>
  </section>
</template>

<!-- TODO(UI): El responsable del CSS debe pulir la presentación visual del historial para alinearla con el diseño final del frontend. -->
<style scoped>
.orders { max-width: 68rem; margin: 2rem auto; padding: 1.5rem; background: #fff; border: 1px solid #e6e8eb; border-radius: 1rem; box-shadow: 0 10px 30px #1522380d; }
.orders-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
h2 { margin: 0; color: #172033; font-size: 1.5rem; }
.eyebrow { margin: 0 0 .35rem; color: #65728a; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.muted { color: #65728a; }
.count { color: #65728a; font-size: 1rem; font-weight: 500; }
.empty { padding: 2rem 1rem; color: #65728a; text-align: center; }
.notice { padding: .8rem 1rem; color: #704c09; background: #fff5d9; border-left: 4px solid #e6ad35; border-radius: .35rem; }
.error { padding: .8rem 1rem; color: #9b1c1c; background: #fff0f0; border-radius: .35rem; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; }
th, td { padding: .8rem .65rem; border-bottom: 1px solid #e9edf2; }
th { color: #65728a; font-size: .8rem; font-weight: 700; }
.order-id { max-width: 17rem; overflow-wrap: anywhere; font-family: monospace; }
.view-button, .secondary { padding: .55rem .8rem; color: #173c78; background: #fff; border: 1px solid #cbd5e1; border-radius: .5rem; cursor: pointer; }
.view-button:hover, .secondary:hover:not(:disabled) { background: #f2f6fc; }
button:disabled { cursor: not-allowed; opacity: .5; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.25rem; }
.order-items { padding: 0; list-style: none; }
.order-items li { display: flex; justify-content: space-between; gap: 1rem; padding: .75rem 0; border-bottom: 1px solid #e9edf2; }
.discount { display: block; color: #16804a; }
.totals { display: grid; grid-template-columns: 1fr auto; gap: .6rem 1rem; max-width: 24rem; margin: 1.5rem 0 0 auto; }
.totals dd { margin: 0; text-align: right; }
.grand-total { color: #172033; font-size: 1.1rem; font-weight: 700; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 640px) { .orders { margin: 1rem .5rem; padding: 1rem; } .orders-heading { align-items: flex-start; flex-direction: column; } .pagination { gap: .5rem; } }
</style>
