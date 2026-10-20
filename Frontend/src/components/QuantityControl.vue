<script setup>
const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 1 }, // cantidad mínima válida (HU-03)
  disabled: Boolean,
});
const emit = defineEmits(['change']);

function set(value) {
  if (Number.isInteger(value) && value >= props.min) emit('change', value);
}
function onInput(e) {
  const v = Number(e.target.value);
  if (Number.isInteger(v) && v >= props.min) emit('change', v);
  else e.target.value = props.modelValue; // valor inválido: se restaura el anterior
}
</script>

<template>
  <div class="qty">
    <button :disabled="disabled || modelValue <= min" @click="set(modelValue - 1)">−</button>
    <input type="number" :min="min" :value="modelValue" :disabled="disabled" @change="onInput" />
    <button :disabled="disabled" @click="set(modelValue + 1)">+</button>
  </div>
</template>