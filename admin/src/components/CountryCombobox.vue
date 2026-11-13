<template>
  <div ref="root" class="combo">
    <input
      :id="id"
      ref="input"
      v-model="text"
      class="combo-input"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen"
      autocomplete="off"
      :placeholder="placeholder"
      @focus="onFocus"
      @click="onClick"
      @input="onInput"
      @keydown="onKey"
      @blur="onBlur"
    />
    <button v-if="modelValue" type="button" class="combo-clear" tabindex="-1" aria-label="나라 선택 지우기" @mousedown.prevent="clear">×</button>

    <ul v-if="isOpen" class="combo-list" role="listbox">
      <li
        v-for="(c, i) in results"
        :key="c.code"
        role="option"
        :aria-selected="c.code === modelValue"
        :class="{ active: i === active, selected: c.code === modelValue }"
        @mousedown.prevent="pick(c)"
        @mouseenter="active = i"
      >
        <span class="combo-flag">{{ countryFlag(c.code) }}</span>
        <span class="combo-name">{{ c.name }}</span>
        <span class="combo-code">{{ c.code }}</span>
      </li>
      <li v-if="!results.length" class="combo-empty">'{{ text }}' 에 맞는 나라가 없어요</li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { countryFlag, findCountry, searchCountries } from '../countries';

const props = defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, default: undefined },
  placeholder: { type: String, default: '나라 검색 (예: 일본, JP)' }
});
const emit = defineEmits(['update:modelValue']);

const root = ref(null);
const input = ref(null);
const isOpen = ref(false);
const typing = ref(false);
const text = ref('');
const active = ref(0);

const label = (code) => {
  const c = findCountry(code);
  return c ? `${countryFlag(c.code)} ${c.name} (${c.code})` : '';
};

// 선택된 값이 바뀌면(외부에서 채울 때 포함) 입력창에 나라 이름을 보여 준다.
watch(
  () => props.modelValue,
  (v) => {
    if (!typing.value) text.value = label(v);
  },
  { immediate: true }
);

const results = computed(() => {
  // 입력 중이 아니면(처음 열었을 때) 전체 목록, 입력 중이면 검색 결과. 이름·코드 모두 검색된다.
  const q = typing.value ? text.value.trim() : '';
  return searchCountries(q).slice(0, 60);
});

function open() {
  isOpen.value = true;
  const i = results.value.findIndex((c) => c.code === props.modelValue);
  active.value = i >= 0 ? i : 0;
  nextTick(scrollToActive);
}

function onFocus() {
  typing.value = false;
  open();
  // 전체 선택: 바로 타이핑하면 검색이 시작된다
  nextTick(() => input.value?.select());
}

/** 이미 포커스된 입력창을 다시 눌러도 목록이 열리게 */
function onClick() {
  if (!isOpen.value) open();
}

function onInput() {
  typing.value = true;
  isOpen.value = true;
  active.value = 0;
}

function pick(c) {
  emit('update:modelValue', c.code);
  typing.value = false;
  text.value = label(c.code);
  isOpen.value = false;
  input.value?.blur();
}

function clear() {
  emit('update:modelValue', '');
  typing.value = false;
  text.value = '';
  isOpen.value = true;
  input.value?.focus();
}

function onBlur() {
  isOpen.value = false;
  typing.value = false;
  text.value = label(props.modelValue);
}

function scrollToActive() {
  root.value?.querySelector('li.active')?.scrollIntoView({ block: 'nearest' });
}

function onKey(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!isOpen.value) return open();
    active.value = Math.min(active.value + 1, results.value.length - 1);
    nextTick(scrollToActive);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    active.value = Math.max(active.value - 1, 0);
    nextTick(scrollToActive);
  } else if (e.key === 'Enter') {
    if (isOpen.value && results.value[active.value]) {
      e.preventDefault();
      pick(results.value[active.value]);
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false;
    typing.value = false;
    text.value = label(props.modelValue);
  }
}
</script>

<style scoped>
.combo { position: relative; }
.combo-input { padding-right: 32px; }
.combo-clear {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
}
.combo-clear:hover { background: var(--sidebar-2); color: var(--ink); }
.combo-list {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 280px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  background: #fff;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(16, 38, 63, 0.16);
}
.combo-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.combo-list li.active { background: var(--accent-soft); }
.combo-list li.selected .combo-name { font-weight: 800; }
.combo-name { flex: 1; }
.combo-code { color: var(--faint); font-size: 11px; font-variant-numeric: tabular-nums; }
.combo-empty { color: var(--muted); cursor: default; }
.combo-empty:hover { background: transparent; }
</style>
