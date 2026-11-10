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
      maxlength="80"
      :disabled="!country"
      :placeholder="country ? '도시 검색 또는 새로 입력 (예: 바르셀로나)' : '먼저 나라를 선택하세요'"
      @focus="onFocus"
      @click="onClick"
      @input="onInput"
      @keydown="onKey"
      @blur="onBlur"
    />
    <button v-if="modelValue && country" type="button" class="combo-clear" tabindex="-1" aria-label="도시 선택 지우기" @mousedown.prevent="clear">×</button>

    <ul v-if="isOpen && country" class="combo-list" role="listbox">
      <li
        v-for="(item, i) in items"
        :key="item.kind + item.value"
        role="option"
        :aria-selected="item.value === modelValue"
        :class="{ active: i === active, selected: item.value === modelValue, 'combo-new': item.kind === 'new' }"
        @mousedown.prevent="pick(item.value)"
        @mouseenter="active = i"
      >
        <template v-if="item.kind === 'new'">
          <span class="combo-plus">＋</span>
          <span class="combo-name">'<b>{{ item.value }}</b>' 새 도시로 추가</span>
        </template>
        <template v-else>
          <span class="combo-name">{{ item.value }}</span>
          <span v-if="item.registered" class="combo-tag">등록됨</span>
        </template>
      </li>
      <li v-if="!items.length" class="combo-empty">{{ options.length ? '검색 결과가 없어요' : '이 나라의 도시가 아직 없어요. 이름을 입력해 추가하세요.' }}</li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { cityOptions } from '../cityPresets';

const props = defineProps({
  modelValue: { type: String, default: '' },
  country: { type: String, default: '' },
  /** 이미 카탈로그에 등록된 이 나라의 도시들 */
  registered: { type: Array, default: () => [] },
  id: { type: String, default: undefined }
});
const emit = defineEmits(['update:modelValue']);

const root = ref(null);
const input = ref(null);
const isOpen = ref(false);
const typing = ref(false);
const text = ref('');
const active = ref(0);

const options = computed(() => cityOptions(props.country, props.registered));
const registeredSet = computed(() => new Set(props.registered));

// 선택된 값이 바뀌면(외부에서 채울 때 포함) 입력창에 보여 준다.
watch(
  () => [props.modelValue, props.country],
  () => {
    if (!typing.value) text.value = props.modelValue || '';
  },
  { immediate: true }
);

/** 목록 항목: 입력 중이면 검색 결과(+ 새 도시 추가), 아니면 전체 */
const items = computed(() => {
  const q = typing.value ? text.value.trim() : '';
  const lower = q.toLowerCase();
  const found = options.value
    .filter((c) => !lower || c.toLowerCase().includes(lower))
    .slice(0, 80)
    .map((c) => ({ kind: 'city', value: c, registered: registeredSet.value.has(c) }));
  const exact = options.value.some((c) => c.toLowerCase() === lower);
  return q && !exact ? [...found, { kind: 'new', value: q }] : found;
});

function open() {
  isOpen.value = true;
  const i = items.value.findIndex((c) => c.value === props.modelValue);
  active.value = i >= 0 ? i : 0;
  nextTick(scrollToActive);
}

function onFocus() {
  typing.value = false;
  open();
  nextTick(() => input.value?.select());
}

function onClick() {
  if (!isOpen.value) open();
}

function onInput() {
  typing.value = true;
  isOpen.value = true;
  // 검색 결과가 있으면 첫 결과, 없으면 "새 도시로 추가" 항목이 선택되도록
  active.value = 0;
}

function pick(value) {
  emit('update:modelValue', String(value).trim());
  typing.value = false;
  text.value = String(value).trim();
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
  text.value = props.modelValue || '';
}

function scrollToActive() {
  root.value?.querySelector('li.active')?.scrollIntoView({ block: 'nearest' });
}

function onKey(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!isOpen.value) return open();
    active.value = Math.min(active.value + 1, items.value.length - 1);
    nextTick(scrollToActive);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    active.value = Math.max(active.value - 1, 0);
    nextTick(scrollToActive);
  } else if (e.key === 'Enter') {
    if (isOpen.value && items.value[active.value]) {
      e.preventDefault();
      pick(items.value[active.value].value);
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false;
    typing.value = false;
    text.value = props.modelValue || '';
  }
}
</script>

<style scoped>
.combo { position: relative; }
.combo-input { padding-right: 32px; }
.combo-input:disabled { background: var(--bg); color: var(--faint); cursor: not-allowed; }
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
.combo-list li.combo-new { color: var(--accent-ink); border-top: 1px dashed var(--line-strong); }
.combo-name { flex: 1; }
.combo-plus { color: var(--accent); font-weight: 800; }
.combo-tag { color: var(--faint); font-size: 11px; }
.combo-empty { color: var(--muted); cursor: default; }
.combo-empty:hover { background: transparent; }
</style>
