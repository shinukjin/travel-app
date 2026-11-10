<template>
  <div ref="rootEl" class="country-select">
    <div class="country-chips">
      <span v-for="code in codes" :key="code" class="country-chip">
        {{ countryFlag(code) }} {{ countryLabel(code) }}
        <button type="button" class="ghost sm" @click.stop="removeCode(code)">×</button>
      </span>
      <button type="button" class="ghost sm" @click.stop="setOpen(!open)">
        {{ open ? '닫기' : '국가 추가' }}
      </button>
    </div>
    <p v-if="!codes.length" class="muted">국가를 하나 이상 선택하세요.</p>
    <div v-if="open" class="country-menu" @pointerdown.stop>
      <input
        ref="searchEl"
        v-model="q"
        placeholder="국가 검색 (일본, FR, 이탈리아…)"
        @keydown.esc.prevent="setOpen(false)"
      />
      <ul>
        <li v-for="item in hits" :key="item.code">
          <button
            type="button"
            :class="{ on: codes.includes(item.code) }"
            @click="toggleCode(item.code)"
          >
            <strong>{{ countryFlag(item.code) }} {{ item.name }}</strong>
            <span>{{ codes.includes(item.code) ? '선택됨' : item.code }}</span>
          </button>
        </li>
        <li v-if="!hits.length" class="empty">검색된 국가가 없습니다.</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { countryFlag, countryLabel, formatCountries, parseCountries, searchCountries } from '../countries';

const props = defineProps({
  modelValue: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const q = ref('');
const searchEl = ref(null);
const rootEl = ref(null);
const codes = computed(() => parseCountries(props.modelValue));
const hits = computed(() => searchCountries(q.value).slice(0, 80));

function setOpen(value) {
  open.value = value;
  if (!value) q.value = '';
}

function emitCodes(next) {
  emit('update:modelValue', formatCountries(next));
}

function removeCode(code) {
  emitCodes(codes.value.filter((item) => item !== code));
  setOpen(false);
}

function toggleCode(code) {
  const next = codes.value.includes(code)
    ? codes.value.filter((item) => item !== code)
    : [...codes.value, code];
  emitCodes(next);
}

function onDocPointerDown(event) {
  if (!rootEl.value?.contains(event.target)) setOpen(false);
}

watch(open, async (value) => {
  if (value) {
    await nextTick();
    searchEl.value?.focus();
  }
});

onMounted(() => document.addEventListener('pointerdown', onDocPointerDown, true));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown, true));
</script>
