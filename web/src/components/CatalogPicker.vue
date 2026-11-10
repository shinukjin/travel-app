<template>
  <template v-if="open">
    <div class="drawer-backdrop" @click="close"></div>
    <aside class="drawer wide" role="dialog" aria-label="추천 관광지">
      <header>
        <h3>추천 관광지 찾기</h3>
        <button type="button" class="ghost sm" @click="close">닫기</button>
      </header>

      <div class="drawer-body catalog-body">
        <p class="muted">운영자가 좌표까지 등록해 둔 관광지예요. 누르면 <b>내 장소</b>에 담기고, 일정에 바로 넣을 수 있어요.</p>

        <p v-if="error" class="login-error">{{ error }}</p>

        <div class="country-strip">
          <button type="button" class="country-chip" :class="{ on: !country }" @click="setCountry('')">전체</button>
          <button v-for="c in countries" :key="c.country" type="button" class="country-chip" :class="{ on: country === c.country }" @click="setCountry(c.country)">
            {{ countryFlag(c.country) }} {{ countryLabel(c.country) }} <b>{{ c.count }}</b>
          </button>
        </div>

        <div class="toolbar catalog-toolbar">
          <input v-model.trim="q" class="search" placeholder="이름·도시·주소 검색 (예: 사그라다, 바르셀로나)" @input="onSearch" />
          <select v-model="category" class="filter-select" @change="reset">
            <option value="">모든 분류</option>
            <option v-for="(label, id) in CATEGORY" :key="id" :value="id">{{ label }}</option>
          </select>
        </div>

        <ul class="catalog-list">
          <li v-for="p in rows" :key="p.id" class="catalog-item">
            <div class="catalog-main">
              <div class="catalog-title">
                <strong>{{ p.name }}</strong>
                <span class="badge" :class="p.category.toLowerCase()">{{ categoryLabel(p.category) }}</span>
              </div>
              <div class="muted">
                {{ countryFlag(p.country) }} {{ [countryLabel(p.country), p.city].filter(Boolean).join(' · ') }}
                <template v-if="p.nameLocal"> · {{ p.nameLocal }}</template>
              </div>
              <div v-if="p.memo" class="catalog-memo">{{ p.memo }}</div>
            </div>
            <button v-if="owned.has(p.id)" type="button" class="ghost sm" disabled>담음 ✓</button>
            <button v-else type="button" class="sm" :disabled="busyId === p.id" @click="add(p)">{{ busyId === p.id ? '담는 중…' : '내 장소에 담기' }}</button>
          </li>
          <li v-if="!rows.length" class="empty">
            {{ loading ? '불러오는 중…' : !countries.length ? '아직 운영자가 등록한 관광지가 없어요.' : '조건에 맞는 관광지가 없어요.' }}
          </li>
        </ul>

        <div v-if="hasMore" class="pager">
          <button type="button" class="ghost sm" :disabled="loading" @click="more">더 보기</button>
        </div>
      </div>
    </aside>
  </template>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { api } from '../api';
import { CATEGORY, categoryLabel } from '../labels';
import { countryFlag, countryLabel, parseCountries } from '../countries';

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 이 여행의 나라 코드 (예: "ES,PT") — 처음 열 때 이 나라로 좁혀 보여 준다 */
  defaultCountry: { type: String, default: '' },
  /** 이미 내 장소로 담은 카탈로그 ID 목록 */
  ownedIds: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:open', 'imported']);

const PAGE = 30;
const countries = ref([]);
const country = ref('');
const q = ref('');
const category = ref('');
const rows = ref([]);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const busyId = ref(0);
const added = ref(new Set());
const owned = computed(() => new Set([...props.ownedIds, ...added.value]));
let timer = null;

function close() {
  emit('update:open', false);
}

async function fetchRows(append = false) {
  loading.value = true;
  error.value = '';
  try {
    const list = await api.catalog.search({ country: country.value, q: q.value, category: category.value, limit: PAGE, offset: append ? rows.value.length : 0 });
    rows.value = append ? [...rows.value, ...list] : list;
    hasMore.value = list.length === PAGE;
  } catch (e) {
    error.value = /catalog|function|relation/i.test(e.message) ? '추천 관광지 기능이 아직 준비되지 않았어요. (운영자: 0004 SQL 적용 필요)' : e.message;
  } finally {
    loading.value = false;
  }
}

function reset() {
  fetchRows(false);
}
function more() {
  fetchRows(true);
}
function onSearch() {
  clearTimeout(timer);
  timer = setTimeout(reset, 300);
}
function setCountry(c) {
  country.value = c;
  reset();
}

async function add(p) {
  busyId.value = p.id;
  error.value = '';
  try {
    const place = await api.catalog.importPlace(p.id);
    added.value = new Set([...added.value, p.id]);
    emit('imported', place);
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = 0;
  }
}

// 열릴 때마다 나라 목록을 불러오고, 여행 나라가 등록돼 있으면 그 나라로 시작한다.
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    q.value = '';
    category.value = '';
    added.value = new Set();
    try {
      countries.value = await api.catalog.countries();
    } catch {
      countries.value = [];
    }
    const mine = parseCountries(props.defaultCountry).find((c) => countries.value.some((x) => x.country === c));
    country.value = mine || '';
    await fetchRows(false);
  },
  { immediate: true }
);
</script>

<style scoped>
.catalog-body { display: flex; flex-direction: column; gap: 12px; }
.country-strip { display: flex; flex-wrap: wrap; gap: 6px; }
.country-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: #fff;
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
}
.country-chip b { color: var(--muted); }
.country-chip:hover { background: var(--accent-soft); }
.country-chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.country-chip.on b { color: var(--tram); }
.catalog-toolbar { padding: 0; border: 0; background: transparent; }
.filter-select { width: auto; }
.catalog-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.catalog-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
}
.catalog-main { min-width: 0; }
.catalog-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.catalog-memo { margin-top: 4px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.pager { display: flex; justify-content: center; padding: 6px 0; }
</style>
