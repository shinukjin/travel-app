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
          <button v-for="c in shownCountries" :key="c.country" type="button" class="country-chip" :class="{ on: country === c.country }" @click="setCountry(c.country)">
            {{ countryFlag(c.country) }} {{ countryLabel(c.country) }} <b>{{ c.count || '준비 중' }}</b>
          </button>
          <!-- 모바일처럼 어느 나라든 고를 수 있게: 추천이 등록되지 않은 나라도 목록에 있다 -->
          <button type="button" class="country-chip" :class="{ on: otherSelected || showOther }" @click="showOther = !showOther">
            🌐 {{ otherSelected ? `${countryFlag(country)} ${countryLabel(country)}` : '다른 나라' }} {{ showOther ? '▲' : '▼' }}
          </button>
        </div>
        <div v-if="showOther" class="other-panel">
          <input v-model.trim="otherQuery" placeholder="나라 검색 (예: 일본, 프랑스)" />
          <ul>
            <li v-for="c in otherList" :key="c.country">
              <button type="button" :class="{ on: country === c.country }" @click="pickOther(c.country)">
                <span>{{ countryFlag(c.country) }} {{ countryLabel(c.country) }}</span>
                <b>{{ c.count || '준비 중' }}</b>
              </button>
            </li>
            <li v-if="!otherList.length" class="muted other-empty">검색한 나라가 없어요.</li>
          </ul>
        </div>

        <!-- 웹(Google 지도)에서 이 나라의 맛집·숙소·관광지를 한 번에 조회하고 내 장소로 등록 -->
        <section class="web-find">
          <div class="web-find-head">
            <strong>웹에서 한 번에 찾기</strong>
            <span class="muted">{{ country ? `${countryFlag(country)} ${countryLabel(country)}` : '위에서 나라를 먼저 고르세요' }}</span>
          </div>
          <div class="web-find-controls">
            <input v-model.trim="webCity" placeholder="도시 (선택, 예: 오사카)" @keydown.enter.prevent="searchWeb" />
            <div class="type-filters" role="group" aria-label="찾을 분류">
              <button v-for="w in WEB_KINDS" :key="w.id" type="button" class="filter-chip" :class="{ on: webKinds.includes(w.id) }" @click="toggleKind(w.id)">
                {{ w.label }}
              </button>
            </div>
            <button type="button" :disabled="!country || webBusy || !webKinds.length" @click="searchWeb">
              {{ webBusy ? '찾는 중…' : '한 번에 조회' }}
            </button>
          </div>
          <p v-if="webError" class="login-error">{{ webError }}</p>
          <div v-for="g in webGroups" :key="g.id" class="web-group">
            <div class="web-group-head">
              <strong>{{ g.label }} <span class="muted">{{ g.rows.length }}</span></strong>
              <button v-if="g.rows.length" type="button" class="ghost sm" :disabled="webBusyAll === g.id" @click="addGroup(g)">
                {{ webBusyAll === g.id ? '담는 중…' : '이 분류 모두 담기' }}
              </button>
            </div>
            <p v-if="!g.rows.length" class="muted">찾지 못했어요.</p>
            <ul class="catalog-list">
              <li v-for="r in g.rows" :key="r.place_id" class="catalog-item">
                <div class="catalog-main">
                  <strong>{{ r.name }}</strong>
                  <div class="muted">{{ r.display_name }}</div>
                </div>
                <button v-if="webAdded.has(r.place_id)" type="button" class="ghost sm" disabled>담음 ✓</button>
                <button v-else type="button" class="sm" :disabled="webBusyId === r.place_id" @click="addWeb(g.id, r)">
                  {{ webBusyId === r.place_id ? '담는 중…' : '내 장소에 담기' }}
                </button>
              </li>
            </ul>
          </div>
        </section>

        <div class="toolbar catalog-toolbar">
          <input v-model.trim="q" class="search" placeholder="이름·도시·주소 검색" @input="onSearch" />
        </div>
        <div class="type-filters" role="group" aria-label="분류">
          <button type="button" class="filter-chip" :class="{ on: !category }" @click="setCategory('')">전체</button>
          <button v-for="(label, id) in CATEGORY" :key="id" type="button" class="filter-chip" :class="{ on: category === id }" @click="setCategory(id)">{{ label }}</button>
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
            {{ loading ? '불러오는 중…' : country && !countMap[country] ? `아직 ${countryLabel(country)} 추천 관광지가 없어요. '장소 직접 등록'에서 검색해 추가할 수 있어요.` : !countries.length ? '아직 운영자가 등록한 관광지가 없어요.' : '조건에 맞는 관광지가 없어요.' }}
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
import { searchPlaces } from '../geocode';
import { countryFlag, countryLabel, parseCountries, searchCountries } from '../countries';

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

const showOther = ref(false);
const otherQuery = ref('');
const countMap = computed(() => Object.fromEntries(countries.value.map((c) => [c.country, c.count])));
const tripCodes = computed(() => parseCountries(props.defaultCountry));
/** 맨 위 칩: 이 여행의 나라 + 추천이 등록된 나라 (여행 나라가 앞) */
const shownCountries = computed(() => {
  const registered = countries.value.map((c) => c.country);
  const codes = [...new Set([...tripCodes.value, ...registered])];
  return codes.slice(0, 10).map((code) => ({ country: code, count: countMap.value[code] || 0 }));
});
const otherSelected = computed(() => !!country.value && !shownCountries.value.some((c) => c.country === country.value));
/** 모든 나라 (등록된 나라가 위) */
const otherList = computed(() => {
  const all = searchCountries(otherQuery.value).map((c) => ({ country: c.code, count: countMap.value[c.code] || 0 }));
  return [...all.filter((c) => c.count > 0), ...all.filter((c) => !c.count)];
});
// ───────── 웹에서 한 번에 찾기 ─────────
const WEB_KINDS = [
  { id: 'FOOD', label: '맛집', word: '맛집' },
  { id: 'STAY', label: '숙소', word: '호텔 숙소' },
  { id: 'SIGHT', label: '관광지', word: '인기 관광지' },
  { id: 'TRANSIT', label: '교통', word: '기차역 공항' }
];
/** 분류마다 가져올 최대 개수 (Google 은 한 번에 20개라 2쪽까지 이어서 받는다) */
const WEB_LIMIT = 30;
const webCity = ref('');
const webKinds = ref(['FOOD', 'STAY', 'SIGHT']);
const webGroups = ref([]);
const webBusy = ref(false);
const webError = ref('');
const webBusyId = ref('');
const webBusyAll = ref('');
const webAdded = ref(new Set());

function toggleKind(id) {
  webKinds.value = webKinds.value.includes(id) ? webKinds.value.filter((k) => k !== id) : [...webKinds.value, id];
}

async function searchWeb() {
  if (!country.value || webBusy.value) return;
  webBusy.value = true;
  webError.value = '';
  try {
    const place = [webCity.value, countryLabel(country.value)].filter(Boolean).join(' ');
    const kinds = WEB_KINDS.filter((k) => webKinds.value.includes(k.id));
    // 분류별 검색을 동시에 보내 한 번에 가져온다
    const results = await Promise.allSettled(kinds.map((k) => searchPlaces(`${place} ${k.word}`, null, country.value, WEB_LIMIT)));
    const seen = new Set();
    webGroups.value = kinds.map((k, i) => {
      const rows = (results[i].status === 'fulfilled' ? results[i].value : []).filter((r) => {
        if (seen.has(r.place_id)) return false;
        seen.add(r.place_id);
        return true;
      });
      return { id: k.id, label: k.label, rows };
    });
    if (results.every((r) => r.status === 'rejected')) webError.value = '웹 검색에 실패했어요. 잠시 뒤 다시 시도해 주세요.';
  } finally {
    webBusy.value = false;
  }
}

async function saveWebPlace(category, r) {
  const place = await api.places.create({
    name: r.name,
    category,
    address: r.display_name || '',
    lat: Number(r.lat),
    lng: Number(r.lon)
  });
  webAdded.value = new Set([...webAdded.value, r.place_id]);
  emit('imported', place);
}

async function addWeb(category, r) {
  webBusyId.value = r.place_id;
  webError.value = '';
  try {
    await saveWebPlace(category, r);
  } catch (e) {
    webError.value = e.message;
  } finally {
    webBusyId.value = '';
  }
}

async function addGroup(g) {
  webBusyAll.value = g.id;
  webError.value = '';
  try {
    for (const r of g.rows) if (!webAdded.value.has(r.place_id)) await saveWebPlace(g.id, r);
  } catch (e) {
    webError.value = e.message;
  } finally {
    webBusyAll.value = '';
  }
}

// 나라나 도시를 바꾸면 이전 웹 조회 결과는 지운다
watch([country, webCity], () => {
  webGroups.value = [];
  webError.value = '';
});

function pickOther(code) {
  showOther.value = false;
  setCountry(code);
}

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
function setCategory(c) {
  category.value = c;
  reset();
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
.country-chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.country-chip.on b { color: #fff; }
.web-find { border: 1px solid var(--accent); border-radius: 12px; padding: 14px; background: var(--accent-soft); display: flex; flex-direction: column; gap: 10px; }
.web-find-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.web-find-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.web-find-controls input { flex: 1; min-width: 140px; }
.web-group { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.web-group-head { display: flex; justify-content: space-between; align-items: center; }
.other-panel { border: 1px solid var(--line-strong); border-radius: 10px; overflow: hidden; background: #fff; }
.other-panel input { border: 0; border-bottom: 1px solid var(--line); border-radius: 0; }
.other-panel ul { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow: auto; }
.other-panel li + li { border-top: 1px solid var(--line); }
.other-panel li button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  color: var(--ink);
  border: 0;
  border-radius: 0;
  font-weight: 600;
}
.other-panel li button:hover { background: var(--accent-soft); }
.other-panel li button.on { background: var(--accent-soft); color: var(--accent-ink); }
.other-panel li button b { color: var(--muted); font-weight: 600; font-size: 13px; }
.other-empty { padding: 14px; text-align: center; }
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
