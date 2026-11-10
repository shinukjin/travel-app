<template>
  <section v-if="trip">
    <div class="page-head">
      <div>
        <p class="crumb"><RouterLink to="/trips">여행 계획</RouterLink> / {{ trip.title }}</p>
        <h2>{{ trip.title }}</h2>
        <p class="lead">
          {{ trip.destination || '도시 미입력' }} · {{ countryLabels(trip.country) }} ·
          {{ formatRange(trip.startDate, trip.endDate) }} · {{ trip.dayCount }}일
        </p>
      </div>
      <div class="actions">
        <div class="mode-switch">
          <button type="button" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">조회</button>
          <button type="button" :class="{ active: tab === 'days' }" @click="tab = 'days'">일정 편집</button>
        </div>
        <button type="button" class="ghost" @click="openMeta = true">기본 정보</button>
      </div>
    </div>
    <p v-if="status" class="flash">{{ status }}</p>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">전체 일정</button>
      <button type="button" :class="{ active: tab === 'days' }" @click="tab = 'days'">일차 구성</button>
      <button type="button" :class="{ active: tab === 'vouchers' }" @click="tab = 'vouchers'">바우처</button>
      <button type="button" :class="{ active: tab === 'packing' }" @click="tab = 'packing'">준비물</button>
      <button type="button" :class="{ active: tab === 'phrases' }" @click="tab = 'phrases'">회화</button>
    </div>

    <div v-if="tab === 'overview'" class="itinerary">
      <div class="toolbar" style="margin-bottom: 12px; border: 1px solid var(--line); border-radius: 8px; background: white">
        <TypeFilters v-model="overviewCats" :options="categoryOptions" />
      </div>
      <article v-for="day in schedules" :key="day.id" class="day-block">
        <header>
          <strong>{{ day.dayIndex }}일차</strong>
          <span class="muted">{{ formatDay(day.date) }}</span>
          <span class="count">{{ day.items.length }}곳</span>
        </header>
        <div v-if="!visibleDayItems(day).length" class="empty">{{ day.items.length ? '선택한 분류의 일정이 없습니다.' : '아직 일정이 없습니다. 일차 구성에서 장소를 넣어 주세요.' }}</div>
        <div v-for="(item, index) in visibleDayItems(day)" :key="item._key || item.id" class="stop">
          <div class="stop-time">{{ formatTime(item.startTime) }}</div>
          <div class="stop-rail"><span class="stop-dot"></span></div>
          <div>
            <div class="stop-title">
              <span class="badge" :class="(item.place?.category || '').toLowerCase()">{{ categoryLabel(item.place?.category) }}</span>
              <strong>{{ index + 1 }}. {{ item.place?.name || item.name }}</strong>
            </div>
            <div class="muted">{{ item.place?.address }}</div>
            <div v-if="item.note" class="muted">{{ item.note }}</div>
          </div>
        </div>
      </article>
    </div>

    <div v-else-if="tab === 'days'" class="workbench">
      <div class="panel">
        <h3>장소</h3>
        <div class="toolbar">
          <input v-model="placeQuery" class="search" placeholder="장소 검색" />
          <TypeFilters v-model="placeCats" :options="categoryOptions" />
        </div>
        <div class="catalog-cta">
          <button type="button" class="ghost sm" @click="catalogOpen = true">추천 관광지에서 찾기</button>
          <span class="muted">{{ countryLabels(trip.country) }}의 좌표 등록된 관광지를 검색해 담아요</span>
        </div>
        <form class="add-place" @submit.prevent="createPlace">
          <strong>새 장소 바로 등록</strong>
          <input v-model="placeForm.name" required placeholder="이름" />
          <select v-model="placeForm.category">
            <option value="FOOD">맛집</option>
            <option value="SIGHT">관광</option>
            <option value="STAY">숙소</option>
            <option value="TRANSIT">교통</option>
          </select>
          <input v-model="placeForm.address" placeholder="주소 (선택)" />
          <p class="muted" v-if="placeForm.lat && placeForm.lng">좌표 {{ Number(placeForm.lat).toFixed(5) }}, {{ Number(placeForm.lng).toFixed(5) }}</p>
          <div class="actions">
            <button type="button" class="ghost sm" @click="mapOpen = true">지도에서 선택</button>
            <button type="submit" class="sm">등록</button>
          </div>
        </form>
        <div v-for="place in visiblePlaces" :key="place.id" class="place-card">
          <div>
            <span class="badge" :class="place.category.toLowerCase()">{{ categoryLabel(place.category) }}</span>
            <strong> {{ place.name }}</strong>
            <div class="muted">{{ place.address }}</div>
          </div>
          <button type="button" class="ghost sm" @click="addToDay(place)">이 날에 넣기</button>
        </div>
        <p v-if="!visiblePlaces.length" class="empty">등록된 장소가 없습니다. 위에서 바로 추가하세요.</p>
      </div>

      <div class="panel">
        <div class="tabs" style="margin: 0; padding: 0 8px">
          <button
            v-for="day in schedules"
            :key="day.id"
            type="button"
            :class="{ active: day.id === selectedDayId }"
            @click="selectedDayId = day.id"
          >
            {{ day.dayIndex }}일차
          </button>
        </div>
        <div class="toolbar">
          <h3 style="padding: 0; border: 0">{{ selectedDay ? `${selectedDay.dayIndex}일차 · ${formatDay(selectedDay.date)}` : '일차 선택' }}</h3>
          <button v-if="selectedDay" type="button" class="sm" @click="saveDay">이 일차 저장</button>
        </div>
        <draggable v-if="selectedDay" v-model="selectedDay.items" item-key="_key" handle=".drag">
          <template #item="{ element, index }">
            <div class="timeline-card">
              <div class="trip-item">
                <strong class="drag" style="cursor: grab">{{ index + 1 }}. {{ element.place?.name || element.name }}</strong>
                <button type="button" class="ghost sm" @click="selectedDay.items.splice(index, 1)">빼기</button>
              </div>
              <div class="grid two" style="margin-top: 8px">
                <div class="form-row">
                  <label>시각</label>
                  <input v-model="element.startTime" type="time" />
                </div>
                <div class="form-row">
                  <label>메모</label>
                  <input v-model="element.note" placeholder="예약, 팁" />
                </div>
              </div>
            </div>
          </template>
        </draggable>
        <p v-if="selectedDay && !selectedDay.items.length" class="drop-hint">왼쪽에서 장소를 이 날에 넣으세요.</p>
      </div>
    </div>

    <div v-else-if="tab === 'vouchers'" class="panel">
      <div class="toolbar">
        <strong>이 여행 바우처</strong>
        <TypeFilters v-model="voucherTypes" :options="voucherOptions" />
        <button type="button" class="sm" @click="voucherOpen = true">등록</button>
      </div>
      <table class="data">
        <thead><tr><th>유형</th><th>제목</th><th>내용</th><th class="right">작업</th></tr></thead>
        <tbody>
          <tr v-for="item in visibleVouchers" :key="item.id">
            <td><span class="badge" :class="item.type.toLowerCase()">{{ voucherLabel(item.type) }}</span></td>
            <td><strong>{{ item.title }}</strong></td>
            <td><pre class="clip muted">{{ item.body }}</pre></td>
            <td class="right"><button type="button" class="danger sm" @click="removeVoucher(item)">삭제</button></td>
          </tr>
          <tr v-if="!visibleVouchers.length"><td colspan="4" class="empty">{{ vouchers.length ? '선택한 유형의 바우처가 없습니다.' : '바우처가 없습니다.' }}</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'packing'" class="panel">
      <div class="toolbar">
        <strong>이 여행 준비물</strong>
        <button
          v-for="item in packedFilters"
          :key="item.id"
          type="button"
          class="filter-chip"
          :class="{ on: packingPacked === item.id }"
          @click="packingPacked = item.id"
        >
          {{ item.label }}
        </button>
        <TypeFilters v-model="packingCats" :options="packingOptions" />
        <input v-model="packingQuery" class="search" placeholder="이름, 메모 검색" />
        <span class="count">{{ filteredPacking.length }}/{{ packingItems.length }} · {{ packingItems.filter((item) => item.packed).length }} 챙김</span>
      </div>
      <form class="add-place" @submit.prevent="createPacking">
        <strong>준비물 추가</strong>
        <input v-model="packingForm.name" required placeholder="여권, 충전기, 상비약…" />
        <select v-model="packingForm.category">
          <option v-for="(label, id) in PACKING" :key="id" :value="id">{{ label }}</option>
        </select>
        <input v-model.number="packingForm.quantity" type="number" min="1" placeholder="수량" />
        <input v-model="packingForm.note" placeholder="메모 (선택)" />
        <button type="submit" class="sm">등록</button>
      </form>
      <div class="pack-suggestions">
        <button
          v-for="hint in unusedHints"
          :key="hint.name"
          type="button"
          class="ghost sm"
          @click="addHint(hint)"
        >
          + {{ hint.name }}
        </button>
      </div>
      <div v-for="group in packingGroups" :key="group.category" class="pack-group" :class="{ collapsed: collapsedPacking[group.category] }">
        <h3 @click="togglePackGroup(group.category)">
          {{ packingLabel(group.category) }}
          <span>{{ collapsedPacking[group.category] ? `${group.items.length}개 숨김` : `${group.items.length}개` }}</span>
        </h3>
        <label v-for="item in group.items" :key="item.id" class="pack-row" :class="{ done: item.packed }">
          <input type="checkbox" :checked="item.packed" @change="togglePacked(item)" />
          <span>
            <strong>{{ item.name }}</strong>
            <span v-if="item.quantity > 1" class="muted"> ×{{ item.quantity }}</span>
            <div v-if="item.note" class="muted">{{ item.note }}</div>
          </span>
          <button type="button" class="danger sm" @click.prevent="removePacking(item)">삭제</button>
        </label>
      </div>
      <p v-if="!packingItems.length" class="empty">아직 준비물이 없습니다. 위에서 바로 추가하세요.</p>
      <p v-else-if="!filteredPacking.length" class="empty">선택한 필터에 맞는 준비물이 없습니다.</p>
    </div>

    <div v-else class="panel">
      <div class="toolbar">
        <strong>이 여행 회화</strong>
        <TypeFilters v-model="phraseLocales" :options="phraseLocaleOptions" />
        <button type="button" class="sm" @click="openPhrase">등록</button>
      </div>
      <table class="data">
        <thead><tr><th>상황</th><th>한국어</th><th>현지어</th><th class="right">작업</th></tr></thead>
        <tbody>
          <tr v-for="item in visiblePhrases" :key="item.id">
            <td><strong>{{ item.situation }}</strong></td>
            <td>{{ item.ko }}</td>
            <td>{{ item.localText }}</td>
            <td class="right"><button type="button" class="danger sm" @click="removePhrase(item)">삭제</button></td>
          </tr>
          <tr v-if="!visiblePhrases.length"><td colspan="4" class="empty">{{ phrases.length ? '선택한 언어의 회화가 없습니다.' : '회화가 없습니다.' }}</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="openMeta" class="drawer-backdrop" @click="openMeta = false"></div>
    <aside v-if="openMeta" class="drawer">
      <header>
        <h3>기본 정보 수정</h3>
        <button type="button" class="ghost sm" @click="openMeta = false">닫기</button>
      </header>
      <form @submit.prevent="saveMeta">
        <div class="form-row"><label>여행 이름</label><input v-model="meta.title" required /></div>
        <div class="form-row">
          <label>국가</label>
          <CountrySelect v-model="meta.country" />
          <p class="muted">여러 나라를 함께 선택할 수 있습니다.</p>
        </div>
        <div class="form-row">
          <label>도시·지역</label>
          <input v-model="meta.destination" placeholder="예: 바르셀로나, 세비야" />
        </div>
        <div class="form-row"><label>시작일</label><input v-model="meta.startDate" type="date" required /></div>
        <div class="form-row"><label>종료일</label><input v-model="meta.endDate" type="date" required /></div>
        <p class="muted">기간을 바꾸면 일차가 다시 맞춰집니다. 겹치는 날짜의 기존 일정은 유지됩니다.</p>
        <div class="actions">
          <button type="submit">저장</button>
          <button type="button" class="ghost" @click="openMeta = false">취소</button>
        </div>
      </form>
    </aside>

    <div v-if="voucherOpen" class="drawer-backdrop" @click="voucherOpen = false"></div>
    <aside v-if="voucherOpen" class="drawer">
      <header>
        <h3>바우처 등록</h3>
        <button type="button" class="ghost sm" @click="voucherOpen = false">닫기</button>
      </header>
      <form @submit.prevent="saveVoucher">
        <div class="form-row"><label>제목</label><input v-model="voucherForm.title" required /></div>
        <div class="form-row">
          <label>유형</label>
          <select v-model="voucherForm.type">
            <option value="FLIGHT">항공</option>
            <option value="HOTEL">호텔</option>
            <option value="TICKET">티켓</option>
          </select>
        </div>
        <div class="form-row"><label>내용</label><textarea v-model="voucherForm.body" required /></div>
        <div class="actions"><button type="submit">저장</button></div>
      </form>
    </aside>

    <div v-if="phraseOpen" class="drawer-backdrop" @click="phraseOpen = false"></div>
    <aside v-if="phraseOpen" class="drawer">
      <header>
        <h3>회화 등록</h3>
        <button type="button" class="ghost sm" @click="phraseOpen = false">닫기</button>
      </header>
      <form @submit.prevent="savePhrase">
        <div class="form-row"><label>상황</label><input v-model="phraseForm.situation" required /></div>
        <div class="form-row"><label>한국어</label><input v-model="phraseForm.ko" required /></div>
        <div class="form-row"><label>현지어</label><input v-model="phraseForm.localText" required /></div>
        <div class="form-row">
          <label>로케일</label>
          <select v-model="phraseForm.locale">
            <option v-for="item in SPEECH_LOCALES" :key="item.id" :value="item.id">{{ item.label }} ({{ item.id }})</option>
          </select>
        </div>
        <div class="actions"><button type="submit">저장</button></div>
      </form>
    </aside>

    <div v-if="mapOpen" class="map-modal-backdrop" @click="mapOpen = false"></div>
    <aside v-if="mapOpen" class="map-modal">
      <header>
        <h3>지도에서 장소 선택</h3>
        <button type="button" class="ghost sm" @click="mapOpen = false">닫기</button>
      </header>
      <MapPicker
        :lat="placeForm.lat"
        :lng="placeForm.lng"
        :center-query="placeForm.name || placeForm.address || trip?.destination"
        @update:lat="placeForm.lat = $event"
        @update:lng="placeForm.lng = $event"
        @picked="applyMapPick"
      />
      <footer>
        <button type="button" @click="mapOpen = false">이 좌표 사용</button>
      </footer>
    </aside>
    <CatalogPicker v-model:open="catalogOpen" :default-country="trip.country" :owned-ids="ownedCatalogIds" @imported="reloadPlaces" />
  </section>
  <p v-else class="empty">여행 계획을 불러오는 중입니다.</p>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import { api } from '../api';
import { CATEGORY, categoryLabel, countryLabels, countryLocale, formatDay, formatRange, formatTime, PACKING, PACKING_HINTS, packingLabel, parseCountries, SPEECH_LOCALES, VOUCHER, voucherLabel } from '../labels';
import { isShown, typeIds } from '../filters';
import MapPicker from '../components/MapPicker.vue';
import CountrySelect from '../components/CountrySelect.vue';
import TypeFilters from '../components/TypeFilters.vue';
import CatalogPicker from '../components/CatalogPicker.vue';

const route = useRoute();
const router = useRouter();
const trip = ref(null);
const schedules = ref([]);
const places = ref([]);
const vouchers = ref([]);
const phrases = ref([]);
const packingItems = ref([]);
const selectedDayId = ref(0);
const tab = ref('overview');
const status = ref('');
const placeQuery = ref('');
const openMeta = ref(false);
const voucherOpen = ref(false);
const phraseOpen = ref(false);
const mapOpen = ref(false);
const catalogOpen = ref(false);
const ownedCatalogIds = computed(() => places.value.map((x) => x.catalogId).filter(Boolean));

async function reloadPlaces() {
  places.value = await api.places.list();
}
const meta = reactive({ title: '', destination: '', country: 'ES', startDate: '', endDate: '' });
const placeForm = reactive({ name: '', category: 'SIGHT', address: '', lat: null, lng: null });
const voucherForm = reactive({ title: '', type: 'FLIGHT', body: '' });
const phraseForm = reactive({ situation: '', ko: '', localText: '', locale: 'es-ES' });
const packingForm = reactive({ name: '', category: 'DOCS', quantity: 1, note: '' });
const packingQuery = ref('');
const packingPacked = ref('ALL');
const packedFilters = [
  { id: 'ALL', label: '전부' },
  { id: 'OPEN', label: '아직' },
  { id: 'DONE', label: '챙김' }
];
const categoryOptions = Object.entries(CATEGORY).map(([id, label]) => ({ id, label }));
const packingOptions = Object.entries(PACKING).map(([id, label]) => ({ id, label }));
const voucherOptions = Object.entries(VOUCHER).map(([id, label]) => ({ id, label }));
const overviewCats = ref(typeIds(categoryOptions));
const placeCats = ref(typeIds(categoryOptions));
const packingCats = ref(typeIds(packingOptions));
const voucherTypes = ref(typeIds(voucherOptions));
const phraseLocales = ref([]);
const collapsedPacking = reactive({});

const selectedDay = computed(() => schedules.value.find((day) => day.id === selectedDayId.value));
const visiblePlaces = computed(() => {
  const q = placeQuery.value.trim().toLowerCase();
  return places.value.filter((place) => {
    const catOk = isShown(placeCats.value, place.category, typeIds(categoryOptions));
    return catOk && (!q || `${place.name} ${place.address || ''}`.toLowerCase().includes(q));
  });
});

const filteredPacking = computed(() => {
  const q = packingQuery.value.trim().toLowerCase();
  return packingItems.value.filter((item) => {
    const catOk = isShown(packingCats.value, item.category, typeIds(packingOptions));
    const packedOk = packingPacked.value === 'ALL' || (packingPacked.value === 'DONE') === !!item.packed;
    const text = `${item.name} ${item.note || ''}`.toLowerCase();
    return catOk && packedOk && (!q || text.includes(q));
  });
});

const packingGroups = computed(() => {
  const groups = [];
  for (const category of Object.keys(PACKING)) {
    const items = filteredPacking.value.filter((item) => item.category === category);
    if (items.length) groups.push({ category, items });
  }
  return groups;
});

const unusedHints = computed(() => {
  const names = new Set(packingItems.value.map((item) => item.name));
  return PACKING_HINTS.filter((hint) => {
    const unused = !names.has(hint.name);
    const catOk = isShown(packingCats.value, hint.category, typeIds(packingOptions));
    return unused && catOk;
  });
});

const visibleVouchers = computed(() =>
  vouchers.value.filter((item) => isShown(voucherTypes.value, item.type, typeIds(voucherOptions)))
);

const phraseLocaleOptions = computed(() => {
  const labels = Object.fromEntries(SPEECH_LOCALES.map((item) => [item.id, item.label]));
  return [...new Set(phrases.value.map((item) => item.locale))].map((id) => ({
    id,
    label: labels[id] || id
  }));
});

const visiblePhrases = computed(() =>
  phrases.value.filter((item) => isShown(phraseLocales.value, item.locale, typeIds(phraseLocaleOptions.value)))
);

function visibleDayItems(day) {
  return (day.items || []).filter((item) =>
    isShown(overviewCats.value, item.place?.category, typeIds(categoryOptions))
  );
}

function togglePackGroup(category) {
  collapsedPacking[category] = !collapsedPacking[category];
}

function mapSchedules(days) {
  return days.map((day) => ({
    ...day,
    items: (day.items || []).map((item) => ({
      ...item,
      _key: item.id || `${item.place?.id}-${Math.random()}`,
      placeId: item.place?.id,
      startTime: item.startTime ? String(item.startTime).slice(0, 5) : ''
    }))
  }));
}

async function load() {
  const id = Number(route.params.id);
  trip.value = await api.trips.get(id);
  Object.assign(meta, trip.value);
  schedules.value = mapSchedules(await api.trips.schedules(id));
  selectedDayId.value = schedules.value[0]?.id || 0;
  places.value = await api.places.list();
  vouchers.value = await api.vouchers.list(id);
  phrases.value = await api.phrases.list(id);
  packingItems.value = await api.packing.list(id);
  const tabs = ['days', 'vouchers', 'packing', 'phrases'];
  tab.value = tabs.includes(route.query.tab) ? route.query.tab : 'overview';
}

function addToDay(place) {
  if (!selectedDay.value) return;
  selectedDay.value.items.push({
    _key: `${place.id}-${Date.now()}`,
    placeId: place.id,
    place,
    name: place.name,
    startTime: '',
    note: ''
  });
}

function applyMapPick(place) {
  placeForm.lat = place.lat;
  placeForm.lng = place.lng;
  if (place.address) placeForm.address = place.address;
  if (place.name && !placeForm.name) placeForm.name = place.name;
}

async function createPlace() {
  const created = await api.places.create({
    name: placeForm.name,
    category: placeForm.category,
    address: placeForm.address,
    lat: placeForm.lat,
    lng: placeForm.lng,
    memo: ''
  });
  places.value = await api.places.list();
  addToDay(created);
  placeForm.name = '';
  placeForm.address = '';
  placeForm.lat = null;
  placeForm.lng = null;
  mapOpen.value = false;
  status.value = `‘${created.name}’을 등록하고 이 날에 넣었습니다.`;
}

async function saveDay() {
  const day = selectedDay.value;
  const payload = day.items.map((item, index) => ({
    placeId: item.placeId || item.place?.id,
    sortOrder: index,
    startTime: item.startTime ? `${item.startTime}:00` : null,
    note: item.note
  }));
  const saved = await api.schedules.saveItems(day.id, payload);
  day.items = mapSchedules([saved])[0].items;
  status.value = `${day.dayIndex}일차 일정을 저장했습니다.`;
}

async function saveMeta() {
  if (!parseCountries(meta.country).length) {
    status.value = '';
    alert('국가를 하나 이상 선택하세요.');
    return;
  }
  trip.value = await api.trips.update(trip.value.id, { ...meta });
  openMeta.value = false;
  status.value = '기본 정보를 저장했습니다. 기간이 바뀌면 일차도 다시 맞춰집니다.';
  schedules.value = mapSchedules(await api.trips.schedules(trip.value.id));
  selectedDayId.value = schedules.value[0]?.id || 0;
}

function packingPayload(item) {
  return {
    tripId: trip.value.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity || 1,
    note: item.note || '',
    packed: !!item.packed,
    sortOrder: item.sortOrder || packingItems.value.length
  };
}

async function createPacking() {
  await api.packing.create(packingPayload(packingForm));
  packingForm.name = '';
  packingForm.note = '';
  packingForm.quantity = 1;
  packingItems.value = await api.packing.list(trip.value.id);
  status.value = '준비물을 추가했습니다.';
}

async function addHint(hint) {
  await api.packing.create(packingPayload({ ...hint, quantity: 1, note: '', packed: false }));
  packingItems.value = await api.packing.list(trip.value.id);
}

async function togglePacked(item) {
  await api.packing.update(item.id, packingPayload({ ...item, packed: !item.packed }));
  packingItems.value = await api.packing.list(trip.value.id);
}

async function removePacking(item) {
  if (!confirm(`‘${item.name}’을 준비물에서 뺄까요?`)) return;
  await api.packing.remove(item.id);
  packingItems.value = await api.packing.list(trip.value.id);
}

async function saveVoucher() {
  await api.vouchers.create({ ...voucherForm, tripId: trip.value.id });
  voucherForm.title = '';
  voucherForm.body = '';
  voucherOpen.value = false;
  vouchers.value = await api.vouchers.list(trip.value.id);
}

function openPhrase() {
  phraseForm.locale = countryLocale(trip.value?.country);
  phraseOpen.value = true;
}

async function savePhrase() {
  await api.phrases.create({ ...phraseForm, tripId: trip.value.id });
  phraseForm.situation = '';
  phraseForm.ko = '';
  phraseForm.localText = '';
  phraseForm.locale = countryLocale(trip.value?.country);
  phraseOpen.value = false;
  phrases.value = await api.phrases.list(trip.value.id);
}

async function removeVoucher(item) {
  if (!confirm('이 바우처를 삭제할까요?')) return;
  await api.vouchers.remove(item.id);
  vouchers.value = await api.vouchers.list(trip.value.id);
}

async function removePhrase(item) {
  if (!confirm('이 문장을 삭제할까요?')) return;
  await api.phrases.remove(item.id);
  phrases.value = await api.phrases.list(trip.value.id);
}

watch(packingCats, (value) => {
  if (value.length === 1) packingForm.category = value[0];
});

watch(() => route.params.id, load, { immediate: true });
watch(tab, (value) => {
  const query = { ...route.query };
  if (value === 'overview') delete query.tab;
  else query.tab = value;
  router.replace({ query });
});
</script>
