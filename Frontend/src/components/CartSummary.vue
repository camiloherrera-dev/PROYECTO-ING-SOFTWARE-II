   <script setup>
   import { useCartStore } from '../stores/cartStore';
   import { money } from '../utils/money';
   const cart = useCartStore();
   </script>

   <template>
     <aside class="resumen">
       <p v-if="!cart.cart.descuentosDisponibles" class="aviso" role="status">
         Los descuentos no están disponibles en este momento. Se muestra el precio sin descuentos.
       </p>
       <dl>
         <dt>Subtotal</dt>
         <dd>{{ money(cart.cart.subtotal) }}</dd>

         <template v-if="cart.cart.descuentoItems > 0">
           <dt>Descuentos en productos</dt>
           <dd class="desc">− {{ money(cart.cart.descuentoItems) }}</dd>
         </template>

         <template v-if="cart.descuentoCarrito">
           <dt>{{ cart.descuentoCarrito.descripcion }}</dt>
           <dd class="desc">− {{ money(cart.descuentoCarrito.monto) }}</dd>
         </template>

         <dt>Total descuentos</dt>
         <dd class="desc">− {{ money(cart.cart.descuentoTotal) }}</dd>

         <dt class="total">Total</dt>
         <dd class="total">{{ money(cart.cart.total) }}</dd>
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