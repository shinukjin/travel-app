<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠</p>
        <h2>관광지 관리</h2>
        <p class="lead">나라별 관광지와 좌표를 등록해 두면, 사용자는 앱·웹에서 검색해서 일정에 바로 담을 수 있어요.</p>
      </div>
      <div class="actions">
        <button type="button" class="ghost" :disabled="busy" @click="exportCsv">CSV 내보내기</button>
        <button type="button" class="ghost" @click="openImport">CSV 일괄 등록</button>
        <button type="button" @click="openCreate">관광지 등록</button>
      </div>
    </div>

    <p v-if="flash" class="flash">{{ flash }}</p>
    <p v-if="error" class="login-error">{{ error }}</p>

    <!-- 나라별 현황 -->
    <div class="country-strip">
      <button type="button" class="country-chip" :class="{ on: !country }" @click="setCountry('')">
        전체 <b>{{ totalAll }}</b>
      </button>
      <button v-for="c in countryCounts" :key="c.country" type="button" class="country-chip" :class="{ on: country === c.country }" @click="setCountry(c.country)">
        {{ countryFlag(c.country) }} {{ countryLabel(c.country) }} <b>{{ c.count }}</b>
      </button>
      <span v-if="!countryCounts.length && !loading" class="muted">아직 등록된 관광지가 없어요. 오른쪽 위 버튼으로 첫 관광지를 등록해 보세요.</span>
    </div>

    <div class="panel">
      <div class="toolbar">
        <input v-model.trim="q" class="search" placeholder="이름·도시·주소 검색" @input="onSearch" />
        <select v-model="category" class="filter-select" @change="reset">
          <option value="">모든 분류</option>
          <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
        <select v-model="status" class="filter-select" @change="reset">
          <option value="all">공개 상태 전체</option>
          <option value="active">공개 중</option>
          <option value="inactive">숨김</option>
        </select>
        <button v-if="total" type="button" class="danger sm" :disabled="busy" @click="removeAllFiltered">{{ filterActive ? '조건에 맞는 전체 삭제' : '전체 삭제' }}</button>
        <button v-if="selected.size" type="button" class="danger sm" :disabled="busy" @click="removeSelected">선택 {{ selected.size }}건 삭제</button>
        <span class="count">{{ total.toLocaleString('ko-KR') }}건</span>
      </div>

      <table class="data clickable">
        <thead>
          <tr><th class="chk"><input type="checkbox" :checked="allOnPage" :disabled="!rows.length" aria-label="이 페이지 모두 선택" @change="togglePage" /></th><th>나라</th><th>도시</th><th>이름</th><th>분류</th><th>좌표</th><th>상태</th><th class="right">작업</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id" :class="{ 'row-muted': !p.isActive }" @click="openEdit(p)">
            <td class="chk" @click.stop><input type="checkbox" :checked="selected.has(p.id)" :aria-label="`${p.name} 선택`" @change="toggle(p.id)" /></td>
            <td>{{ countryFlag(p.country) }} {{ countryLabel(p.country) }}</td>
            <td>{{ p.city || '-' }}</td>
            <td>
              <strong>{{ p.name }}</strong>
              <div v-if="p.nameLocal" class="muted">{{ p.nameLocal }}</div>
            </td>
            <td><span class="badge" :class="`cat-${p.category.toLowerCase()}`">{{ categoryLabel(p.category) }}</span></td>
            <td class="num">
              <a :href="mapsUrl(p)" target="_blank" rel="noreferrer" @click.stop>{{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}</a>
            </td>
            <td><span class="badge" :class="p.isActive ? 'ok' : ''">{{ p.isActive ? '공개' : '숨김' }}</span></td>
            <td class="right" @click.stop>
              <button type="button" class="sm" @click="openEdit(p)">수정</button>
              <button type="button" class="danger sm" :disabled="busy" @click="removeOne(p)">삭제</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="8" class="empty">{{ loading ? '불러오는 중…' : '조건에 맞는 관광지가 없습니다.' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <button type="button" class="ghost sm" :disabled="page === 0 || loading" @click="go(page - 1)">이전</button>
        <span class="muted">{{ page + 1 }} / {{ pages }}</span>
        <button type="button" class="ghost sm" :disabled="page + 1 >= pages || loading" @click="go(page + 1)">다음</button>
      </div>
    </div>

    <!-- ───────── 등록 / 수정 패널 ───────── -->
    <template v-if="editing">
      <div class="drawer-backdrop" @click="closeEdit"></div>
      <aside class="drawer wide" role="dialog" aria-label="관광지 편집">
        <header>
          <h3>{{ form.id ? '관광지 수정' : '관광지 등록' }}</h3>
          <button type="button" class="ghost sm" @click="closeEdit">닫기</button>
        </header>

        <div class="drawer-body user-drawer">
          <p v-if="formError" class="login-error">{{ formError }}</p>

          <form class="ud-form" @submit.prevent="save">
            <div class="ud-inline">
              <div class="form-row">
                <label for="cp-country">나라 <span class="muted">(검색해서 선택)</span></label>
                <CountryCombobox id="cp-country" v-model="form.country" />
              </div>
              <div class="form-row">
                <label for="cp-city">도시·지역 <span class="muted">(검색하거나 새로 입력)</span></label>
                <CityCombobox id="cp-city" v-model="form.city" :country="form.country" :registered="cityList" />
              </div>
            </div>

            <div class="form-row">
              <label for="cp-name">이름</label>
              <input id="cp-name" v-model="form.name" maxlength="120" required placeholder="예: 사그라다 파밀리아" />
            </div>
            <div class="form-row">
              <label for="cp-local">현지·영문 이름 <span class="muted">(검색에 함께 쓰여요)</span></label>
              <input id="cp-local" v-model="form.nameLocal" maxlength="120" placeholder="예: Sagrada Família" />
            </div>

            <div class="form-row">
              <label for="cp-cat">분류</label>
              <select id="cp-cat" v-model="form.category" required>
                <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option>
              </select>
            </div>

            <div class="form-row">
              <label for="cp-coords">좌표 <span class="muted">(위도, 경도)</span></label>
              <input id="cp-coords" v-model="form.coords" required placeholder="41.4036, 2.1744" @blur="syncCoords" />
              <span class="muted">구글 지도에서 장소를 우클릭하면 나오는 좌표를 그대로 붙여넣으세요.</span>
              <div v-if="coordsOk" class="coords-check">
                <span>위도 {{ parsed.lat }} · 경도 {{ parsed.lng }}</span>
                <a :href="mapsUrl(parsed)" target="_blank" rel="noreferrer">구글 지도에서 확인 ↗</a>
              </div>
              <span v-else-if="form.coords" class="login-hint-error">좌표 형식이 올바르지 않아요. 예: 41.4036, 2.1744</span>
            </div>

            <div class="form-row">
              <label for="cp-addr">주소</label>
              <input id="cp-addr" v-model="form.address" maxlength="300" placeholder="예: Carrer de Mallorca, 401" />
            </div>
            <div class="form-row">
              <label for="cp-memo">설명 · 팁</label>
              <textarea id="cp-memo" v-model="form.memo" maxlength="2000" placeholder="예약 필요 여부, 추천 시간대 등 (사용자가 장소를 가져오면 함께 복사돼요)"></textarea>
            </div>

            <label class="ud-check">
              <input v-model="form.isActive" type="checkbox" />
              사용자에게 공개
            </label>

            <div class="actions">
              <button type="submit" :disabled="busy">{{ busy ? '저장 중…' : form.id ? '변경 저장' : '등록' }}</button>
              <button v-if="form.id" type="button" class="danger" :disabled="busy" @click="remove">삭제</button>
            </div>
            <p v-if="form.id" class="muted">삭제해도 사용자가 이미 가져간 장소(내 장소)는 그대로 남아요. 잠시 내리고 싶다면 "공개"를 끄세요.</p>
          </form>
        </div>
      </aside>
    </template>

    <!-- ───────── CSV 일괄 등록 ───────── -->
    <template v-if="importing">
      <div class="drawer-backdrop" @click="closeImport"></div>
      <aside class="drawer wide" role="dialog" aria-label="CSV 일괄 등록">
        <header>
          <h3>CSV 일괄 등록</h3>
          <button type="button" class="ghost sm" @click="closeImport">닫기</button>
        </header>

        <div class="drawer-body user-drawer">
          <div class="ud-summary">
            <strong>1. 양식 받기 → 2. 채우기 → 3. 파일 선택</strong>
            <p class="muted">필수 열: <code>country, name, category, lat, lng</code> · 선택: <code>city, name_local, address, memo</code><br />
              나라는 코드(ES) 또는 한글(스페인), 분류는 관광/맛집/숙소/교통으로 적어요. 이미 등록된 항목(나라·도시·이름이 같음)은 건너뜁니다.</p>
            <div class="actions">
              <button type="button" class="ghost" @click="downloadTemplate">양식 받기</button>
              <label class="file-btn">
                CSV 파일 선택
                <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,application/vnd.ms-excel" @change="onFile" />
              </label>
              <span v-if="importEncoding" class="muted">읽은 형식: {{ importEncoding }}</span>
            </div>
            <p class="muted">엑셀에서 저장할 때는 "CSV (쉼표로 분리)"든 "CSV UTF-8"든 모두 읽어요. 쉼표·탭·세미콜론 구분도 자동으로 인식해요.</p>

            <details class="paste-box" :open="!importItems.length && !importError">
              <summary>또는 엑셀·구글 시트에서 복사해서 붙여넣기</summary>
              <textarea v-model="pasteText" placeholder="머리글(첫 줄)부터 데이터까지 셀을 복사해서 붙여넣으세요"></textarea>
              <div class="actions">
                <button type="button" class="ghost sm" :disabled="!pasteText.trim()" @click="onPaste">붙여넣은 내용 확인</button>
              </div>
            </details>
          </div>

          <p v-if="importError" class="login-error">{{ importError }}</p>

          <div v-if="importResult" class="import-result">
            <p>
              <b class="ok-text">{{ importResult.inserted }}건 등록</b>
              <span v-if="importResult.skipped"> · 이미 있어서 건너뜀 {{ importResult.skipped }}건</span>
              <span v-if="importResult.failed.length"> · <b class="err-text">실패 {{ importResult.failed.length }}건</b></span>
            </p>
            <table v-if="importResult.failed.length" class="data ud-logs">
              <thead><tr><th>이름</th><th>나라</th><th>이유</th></tr></thead>
              <tbody>
                <tr v-for="(f, i) in importResult.failed" :key="i"><td>{{ f.name }}</td><td>{{ f.country }}</td><td class="err-text">{{ f.reason }}</td></tr>
              </tbody>
            </table>
          </div>

          <template v-if="importItems.length">
            <p class="import-sum">
              총 <b>{{ importItems.length }}</b>건 · 등록 가능 <b class="ok-text">{{ importValid.length }}</b>건
              <span v-if="importInvalid.length"> · 오류 <b class="err-text">{{ importInvalid.length }}</b>건</span>
              <span v-if="importDups"> · 파일 내 중복 <b>{{ importDups }}</b>건(건너뜀)</span>
            </p>

            <table class="data ud-logs">
              <thead><tr><th>줄</th><th>나라</th><th>이름</th><th>분류</th><th>좌표</th><th>결과</th></tr></thead>
              <tbody>
                <tr v-for="it in importItems.slice(0, 200)" :key="it.line" :class="{ 'row-banned': it.errors.length }">
                  <td class="num">{{ it.line }}</td>
                  <td>{{ it.row.country }}</td>
                  <td>{{ it.row.name }}</td>
                  <td>{{ categoryLabel(it.row.category) }}</td>
                  <td class="num">{{ Number.isFinite(it.row.lat) ? it.row.lat : '?' }}, {{ Number.isFinite(it.row.lng) ? it.row.lng : '?' }}</td>
                  <td>
                    <span v-if="it.errors.length" class="err-text">{{ it.errors.join(' · ') }}</span>
                    <span v-else-if="it.dup" class="muted">파일 내 중복</span>
                    <span v-else class="ok-text">OK</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="importItems.length > 200" class="muted">미리보기는 처음 200줄만 보여줘요. 등록은 전체가 대상입니다.</p>

            <div class="actions">
              <button type="button" :disabled="busy || !importValid.length" @click="runImport">
                {{ busy ? progressText : `${importValid.length}건 등록` }}
              </button>
              <span v-if="importInvalid.length" class="muted">오류가 있는 줄은 제외하고 등록해요.</span>
            </div>
          </template>
        </div>
      </aside>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { adminApi } from '../adminApi';
import { countryFlag, countryLabel } from '../countries';
import { cityOptions } from '../cityPresets';
import CountryCombobox from '../components/CountryCombobox.vue';
import CityCombobox from '../components/CityCombobox.vue';
import { CATEGORIES, CSV_TEMPLATE, categoryLabel, dupKey, normalizeCatalogRow, parseCatalogCsv, parseCoords } from '../catalogRules';
import { downloadCsv, readTextFile, toCsv } from '../adminCsv';

const PAGE_SIZE = 30;

const rows = ref([]);
const total = ref(0);
const page = ref(0);
const q = ref('');
const category = ref('');
const status = ref('all');
const country = ref('');
const countryCounts = ref([]);
const loading = ref(false);
const selected = ref(new Set());
const allOnPage = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.id)));
function toggle(id) {
  const s = new Set(selected.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selected.value = s;
}
function togglePage() {
  selected.value = allOnPage.value ? new Set() : new Set(rows.value.map((r) => r.id));
}
const busy = ref(false);
const error = ref('');
const flash = ref('');
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const totalAll = computed(() => countryCounts.value.reduce((s, c) => s + c.count, 0));
let timer = null;

const mapsUrl = (p) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;

async function loadCounts() {
  try {
    countryCounts.value = (await adminApi.catalog.countries()) || [];
  } catch {
    countryCounts.value = [];
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await adminApi.catalog.list({ country: country.value, category: category.value, q: q.value, status: status.value, limit: PAGE_SIZE, offset: page.value * PAGE_SIZE });
    rows.value = res.rows;
    total.value = res.total;
    selected.value = new Set();
  } catch (e) {
    error.value = /relation|does not exist|catalog_places/i.test(e.message)
      ? '관광지 테이블이 없습니다. supabase/migrations/0004_catalog_insights.sql 을 실행해 주세요.'
      : e.message;
  } finally {
    loading.value = false;
  }
}

function reset() {
  page.value = 0;
  load();
}
function onSearch() {
  clearTimeout(timer);
  timer = setTimeout(reset, 300);
}
function setCountry(c) {
  country.value = c;
  reset();
}
function go(n) {
  page.value = n;
  load();
}

/* ── 등록 / 수정 ── */
const editing = ref(false);
const formError = ref('');
const emptyForm = () => ({ id: null, country: '', city: '', name: '', nameLocal: '', category: 'SIGHT', coords: '', address: '', memo: '', isActive: true });
const form = reactive(emptyForm());
const parsed = computed(() => parseCoords(form.coords));

// 나라를 고르면 그 나라에 이미 등록된 도시를 불러와 선택 목록에 합친다.
// 나라가 바뀌어 현재 도시가 새 나라의 목록에 없으면 비운다.
const cityList = ref([]);
watch(
  () => form.country,
  async (c) => {
    cityList.value = [];
    if (!c) {
      form.city = '';
      return;
    }
    try {
      cityList.value = await adminApi.catalog.cities(c);
    } catch {
      cityList.value = [];
    }
    if (form.country === c && form.city && !cityOptions(c, cityList.value).includes(form.city)) {
      // 수정 중인 항목이 원래 가진 도시라면 목록에 들어 있으므로 여기서 지워지지 않는다.
      const original = rows.value.find((r) => r.id === form.id);
      if (!(original && original.country === c && original.city === form.city)) form.city = '';
    }
  }
);
const coordsOk = computed(() => !!parsed.value && Math.abs(parsed.value.lat) <= 90 && Math.abs(parsed.value.lng) <= 180);

function openCreate() {
  Object.assign(form, emptyForm(), { country: country.value || '' });
  formError.value = '';
  editing.value = true;
}
function openEdit(p) {
  Object.assign(form, { id: p.id, country: p.country, city: p.city || '', name: p.name, nameLocal: p.nameLocal || '', category: p.category, coords: `${p.lat}, ${p.lng}`, address: p.address || '', memo: p.memo || '', isActive: p.isActive });
  formError.value = '';
  editing.value = true;
}
function closeEdit() {
  editing.value = false;
}
function syncCoords() {
  if (parsed.value) form.coords = `${parsed.value.lat}, ${parsed.value.lng}`;
}

async function save() {
  formError.value = '';
  const c = parsed.value || {};
  const { row, errors } = normalizeCatalogRow({ ...form, lat: c.lat, lng: c.lng });
  if (errors.length) {
    formError.value = errors.join(' · ');
    return;
  }
  busy.value = true;
  try {
    if (form.id) await adminApi.catalog.update(form.id, row);
    else await adminApi.catalog.create(row);
    flash.value = form.id ? '관광지를 수정했습니다.' : '관광지를 등록했습니다.';
    editing.value = false;
    await Promise.all([load(), loadCounts()]);
  } catch (e) {
    formError.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!window.confirm(`'${form.name}' 을(를) 삭제할까요?\n사용자가 이미 가져간 장소는 그대로 남아요.`)) return;
  busy.value = true;
  try {
    await adminApi.catalog.remove(form.id);
    flash.value = '관광지를 삭제했습니다.';
    editing.value = false;
    await Promise.all([load(), loadCounts()]);
  } catch (e) {
    formError.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function removeOne(p) {
  if (!window.confirm(`'${p.name}' 을(를) 삭제할까요?\n사용자가 이미 가져간 장소는 그대로 남아요.`)) return;
  busy.value = true;
  error.value = '';
  try {
    await adminApi.catalog.remove(p.id);
    flash.value = '관광지를 삭제했습니다.';
    await Promise.all([load(), loadCounts()]);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const filterActive = computed(() => !!(country.value || category.value || q.value || status.value !== 'all'));

async function removeAllFiltered() {
  const n = total.value;
  if (!n) return;
  const scope = filterActive.value
    ? `현재 조건(${[country.value && countryLabel(country.value), category.value && categoryLabel(category.value), q.value && `"${q.value}"`, status.value === 'active' ? '공개' : status.value === 'inactive' ? '숨김' : ''].filter(Boolean).join(', ')})에 맞는`
    : '등록된 모든';
  const typed = window.prompt(`${scope} 관광지 ${n.toLocaleString('ko-KR')}건을 모두 삭제합니다.\n사용자가 이미 가져간 장소는 그대로 남지만, 이 작업은 되돌릴 수 없어요.\n\n계속하려면 "삭제"라고 입력하세요.`);
  if (typed === null) return;
  if (typed.trim() !== '삭제') {
    error.value = '"삭제"라고 정확히 입력해야 진행돼요. 아무것도 지우지 않았습니다.';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const removed = await adminApi.catalog.removeFiltered({ country: country.value, category: category.value, q: q.value, status: status.value });
    flash.value = `${removed.toLocaleString('ko-KR')}건을 삭제했습니다.`;
    page.value = 0;
    await Promise.all([load(), loadCounts()]);
  } catch (e) {
    error.value = e.message;
    await Promise.all([load(), loadCounts()]);
  } finally {
    busy.value = false;
  }
}

async function removeSelected() {
  const ids = [...selected.value];
  if (!ids.length) return;
  if (!window.confirm(`선택한 ${ids.length}건을 삭제할까요?\n사용자가 이미 가져간 장소는 그대로 남아요. 되돌릴 수 없어요.`)) return;
  busy.value = true;
  error.value = '';
  try {
    await adminApi.catalog.removeMany(ids);
    flash.value = `${ids.length}건을 삭제했습니다.`;
    await Promise.all([load(), loadCounts()]);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

/* ── CSV 내보내기 ── */
const CSV_COLUMNS = [
  { key: 'country', label: 'country' },
  { key: 'city', label: 'city' },
  { key: 'name', label: 'name' },
  { key: 'nameLocal', label: 'name_local' },
  { label: 'category', value: (r) => categoryLabel(r.category) },
  { key: 'lat', label: 'lat' },
  { key: 'lng', label: 'lng' },
  { key: 'address', label: 'address' },
  { key: 'memo', label: 'memo' }
];

async function exportCsv() {
  busy.value = true;
  error.value = '';
  try {
    const all = await adminApi.catalog.listAll({ country: country.value, category: category.value, q: q.value, status: status.value });
    downloadCsv(`관광지_${country.value || '전체'}_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(all, CSV_COLUMNS));
    flash.value = `${all.length}건을 내보냈습니다.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

/* ── CSV 일괄 등록 ── */
const importing = ref(false);
const importItems = ref([]);
const importError = ref('');
const progressText = ref('');
const importEncoding = ref('');
const importResult = ref(null);
const pasteText = ref('');

const importValid = computed(() => importItems.value.filter((i) => !i.errors.length && !i.dup));
const importInvalid = computed(() => importItems.value.filter((i) => i.errors.length));
const importDups = computed(() => importItems.value.filter((i) => !i.errors.length && i.dup).length);

function openImport() {
  importing.value = true;
  importItems.value = [];
  importError.value = '';
  importEncoding.value = '';
  importResult.value = null;
  pasteText.value = '';
}
function closeImport() {
  importing.value = false;
}
function downloadTemplate() {
  downloadCsv('관광지_등록_양식.csv', CSV_TEMPLATE);
}

/** 읽은 텍스트를 해석해 미리보기를 만든다 (파일·붙여넣기 공통) */
function loadText(text) {
  importError.value = '';
  importItems.value = [];
  importResult.value = null;
  const res = parseCatalogCsv(text);
  if (res.error) {
    importError.value = res.error;
    return;
  }
  if (res.items.length > 2000) {
    importError.value = '한 번에 최대 2,000건까지 등록할 수 있어요. 파일을 나눠 주세요.';
    return;
  }
  const seen = new Set();
  for (const it of res.items) {
    if (it.errors.length) continue;
    const k = dupKey(it.row);
    it.dup = seen.has(k);
    seen.add(k);
  }
  importItems.value = res.items;
  // 한글이 모두 깨져 읽혔다면 (다른 인코딩) 원인을 짚어 준다
  if (res.items.length && res.items.every((i) => i.errors.length) && /\uFFFD/.test(text)) {
    importError.value = '글자가 깨져서 읽혔어요. 엑셀에서 "CSV UTF-8(쉼표로 분리)"로 다시 저장하거나, 셀을 복사해서 아래 붙여넣기를 사용해 주세요.';
  }
}

async function onFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  importError.value = '';
  importItems.value = [];
  importResult.value = null;
  if (file.size > 3 * 1024 * 1024) {
    importError.value = '파일이 너무 큽니다 (3MB 이하).';
    return;
  }
  try {
    const { text, encoding } = await readTextFile(file);
    importEncoding.value = encoding;
    loadText(text);
  } catch (err) {
    importError.value = '파일을 읽지 못했어요: ' + err.message;
  }
}

function onPaste() {
  importEncoding.value = '붙여넣기';
  loadText(pasteText.value);
}

async function runImport() {
  busy.value = true;
  progressText.value = '등록 중…';
  importError.value = '';
  try {
    const result = await adminApi.catalog.importRows(importValid.value.map((i) => i.row), (done, all) => {
      progressText.value = `등록 중… ${done}/${all}`;
    });
    flash.value = `${result.inserted}건을 등록했습니다.${result.skipped ? ` (이미 있는 ${result.skipped}건은 건너뜀)` : ''}${result.failed.length ? ` 실패 ${result.failed.length}건` : ''}`;
    await Promise.all([load(), loadCounts()]);
    if (result.failed.length) {
      // 실패한 줄이 있으면 이유를 보여 주려고 패널을 열어 둔다
      importResult.value = result;
      importItems.value = [];
    } else {
      importing.value = false;
    }
  } catch (e) {
    importError.value = e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  load();
  loadCounts();
});
</script>
