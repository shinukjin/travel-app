<template>
  <div class="type-filters">
    <button type="button" class="filter-chip" :class="{ on: allOn }" @click="showAll">전체</button>
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="filter-chip"
      :class="{ on: !allOn && modelValue.includes(opt.id) }"
      @click="toggle(opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { showingAll, toggleVisible, typeIds } from '../filters';

const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue']);

const ids = computed(() => typeIds(props.options));
const allOn = computed(() => showingAll(props.modelValue, ids.value));

function showAll() {
  emit('update:modelValue', [...ids.value]);
}

function toggle(id) {
  emit('update:modelValue', toggleVisible(props.modelValue, id, ids.value));
}
</script>
