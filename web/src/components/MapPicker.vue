<template>
  <div class="map-picker">
    <div class="map-search">
      <!-- 모바일처럼 나라를 골라 그 나라 안에서 찾을 수 있다 (비우면 전 세계) -->
      <select v-model="searchCountry" class="map-country" aria-label="검색할 나라">
        <option value="">🌍 전체 나라</option>
        <option v-for="c in countryOptions" :key="c.code" :value="c.code">{{ countryFlag(c.code) }} {{ c.name }}</option>
      </select>
      <input
        v-model="q"
        placeholder="장소 이름이나 주소 (예: 센소지, Eiffel Tower)"
        @keydown.enter.prevent="search"
      />
      <button type="button" class="ghost sm" @click="search" :disabled="searching">
        {{ searching ? '검색 중' : '검색' }}
      </button>
    </div>
    <p v-if="error" class="muted" style="color:#b91c1c">{{ error }}</p>
    <ul v-if="hits.length" class="map-hits">
      <li v-for="hit in hits" :key="hit.place_id">
        <button type="button" @click="chooseHit(hit)">
          <strong>{{ hit.name || hit.display_name.split(',')[0] }}</strong>
          <span>{{ hit.display_name }}</span>
        </button>
      </li>
    </ul>
    <div ref="mapEl" class="map-canvas"></div>
    <p class="muted">
      검색하거나 지도를 클릭하면 좌표가 채워집니다.
      <strong v-if="lat != null && lng != null"> {{ Number(lat).toFixed(5) }}, {{ Number(lng).toFixed(5) }}</strong>
    </p>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { hitToPlace, reverseGeocode, searchPlaces } from '../geocode';
import { COUNTRIES, countryFlag, parseCountries } from '../countries';

const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  centerQuery: { type: String, default: '' },
  /** 이 여행의 나라 코드 (예: "JP" 또는 "ES,PT") — 목록 맨 위에 두고 처음 선택해 둔다 */
  country: { type: String, default: '' }
});

const tripCodes = parseCountries(props.country);
const searchCountry = ref(tripCodes.length === 1 ? tripCodes[0] : '');
/** 여행 나라를 먼저, 나머지 모든 나라를 뒤에 */
const countryOptions = [
  ...tripCodes.map((code) => COUNTRIES.find((c) => c.code === code)).filter(Boolean),
  ...COUNTRIES.filter((c) => !tripCodes.includes(c.code))
];

const emit = defineEmits(['update:lat', 'update:lng', 'picked']);

const mapEl = ref(null);
const q = ref(props.centerQuery || '');
const hits = ref([]);
const searching = ref(false);
const error = ref('');
let map;
let marker;
let Lref;
let resizeObserver;

function round6(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

function applyCoords(lat, lng, extra = {}) {
  const nextLat = round6(lat);
  const nextLng = round6(lng);
  emit('update:lat', nextLat);
  emit('update:lng', nextLng);
  emit('picked', { lat: nextLat, lng: nextLng, ...extra });
  placeMarker(nextLat, nextLng);
}

function placeMarker(lat, lng) {
  if (!map || !Lref) return;
  const point = [lat, lng];
  if (marker) marker.setLatLng(point);
  else marker = Lref.marker(point).addTo(map);
  map.setView(point, Math.max(map.getZoom(), 16));
}

async function search() {
  error.value = '';
  searching.value = true;
  try {
    // 지도를 어느 정도 확대해 둔 상태라면 그 근처를 우선해서 찾는다
    const c = map && map.getZoom() >= 10 ? map.getCenter() : null;
    hits.value = await searchPlaces(q.value, c ? { lat: c.lat, lng: c.lng } : null, searchCountry.value);
    if (!hits.value.length) error.value = '검색 결과가 없습니다.';
  } catch (err) {
    error.value = err.message;
  } finally {
    searching.value = false;
  }
}

async function chooseHit(hit) {
  const place = hitToPlace(hit);
  hits.value = [];
  q.value = place.name;
  applyCoords(place.lat, place.lng, { name: place.name, address: place.address });
}

async function loadLeaflet() {
  if (window.L) return window.L;
  await new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.setAttribute('data-leaflet', 'true');
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('지도를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
  return window.L;
}

onMounted(async () => {
  try {
    Lref = await loadLeaflet();
    Lref.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
    await nextTick();
    // 좌표가 없으면 어느 나라 여행이든 어색하지 않게 세계 지도로 시작 (검색하면 그곳으로 이동)
    const startLat = props.lat || 25;
    const startLng = props.lng || 20;
    map = Lref.map(mapEl.value, { scrollWheelZoom: true }).setView([startLat, startLng], props.lat ? 16 : 2);
    Lref.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    if (props.lat && props.lng) placeMarker(props.lat, props.lng);
    map.on('click', async (event) => {
      const { lat, lng } = event.latlng;
      applyCoords(lat, lng);
      const rev = await reverseGeocode(lat, lng);
      if (rev) {
        emit('picked', {
          lat,
          lng,
          name: rev.name || rev.display_name?.split(',')[0] || '',
          address: rev.display_name || ''
        });
      }
    });
    resizeObserver = new ResizeObserver(() => map?.invalidateSize());
    if (mapEl.value) resizeObserver.observe(mapEl.value);
    setTimeout(() => map.invalidateSize(), 160);
    if (!props.lat && props.centerQuery) {
      const found = await searchPlaces(props.centerQuery, null, searchCountry.value);
      if (found[0]) map.setView([Number(found[0].lat), Number(found[0].lon)], 12);
    }
  } catch (err) {
    error.value = err.message;
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (map) {
    map.remove();
    map = null;
    marker = null;
  }
});

watch(() => [props.lat, props.lng], ([lat, lng]) => {
  if (lat != null && lng != null) placeMarker(Number(lat), Number(lng));
});
</script>
