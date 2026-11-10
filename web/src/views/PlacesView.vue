<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠 / 장소</p>
        <h2>장소 관리</h2>
        <p class="lead">맛집·관광·숙소·교통 카드를 등록합니다. 지도에서 고르거나 검색하면 좌표가 채워집니다.</p>
      </div>
      <div class="actions">
        <button type="button" class="ghost" @click="catalogOpen = true">추천 관광지에서 찾기</button>
        <button type="button" @click="openCreate">장소 등록</button>
      </div>
    </div>

    <div class="panel">
      <div class="toolbar">
        <input v-model="query" class="search" placeholder="이름, 주소 검색" />
        <TypeFilters v-model="categories" :options="categoryOptions" />
        <span class="count">{{ filtered.length }}건</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>분류</th>
            <th>이름</th>
            <th>주소</th>
            <th>좌표</th>
            <th class="right">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="place in filtered" :key="place.id">
            <td><span class="badge" :class="place.category.toLowerCase()">{{ categoryLabel(place.category) }}</span></td>
            <td><strong>{{ place.name }}</strong></td>
            <td>{{ place.address || '-' }}</td>
            <td class="num">{{ place.lat && place.lng ? `${place.lat}, ${place.lng}` : '-' }}</td>
            <td class="right">
              <div class="row-actions">
                <button type="button" class="ghost sm" @click="edit(place)">수정</button>
                <button type="button" class="danger sm" @click="remove(place)">삭제</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="5" class="empty">등록된 장소가 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="open" class="drawer-backdrop" @click="close"></div>
    <aside v-if="open" class="drawer wide">
      <header>
        <h3>{{ form.id ? '장소 수정' : '장소 등록' }}</h3>
        <button type="button" class="ghost sm" @click="close">닫기</button>
      </header>
      <form @submit.prevent="save">
        <div class="form-row"><label>이름</label><input v-model="form.name" required /></div>
        <div class="form-row">
          <label>분류</label>
          <select v-model="form.category">
            <option value="FOOD">맛집</option>
            <option value="SIGHT">관광</option>
            <option value="STAY">숙소</option>
            <option value="TRANSIT">교통</option>
          </select>
        </div>
        <MapPicker
          :lat="form.lat"
          :lng="form.lng"
          :center-query="form.name || form.address"
          @update:lat="form.lat = $event"
          @update:lng="form.lng = $event"
          @picked="applyPick"
        />
        <div class="grid two">
          <div class="form-row"><label>위도</label><input v-model.number="form.lat" type="number" step="any" /></div>
          <div class="form-row"><label>경도</label><input v-model.number="form.lng" type="number" step="any" /></div>
        </div>
        <div class="form-row"><label>주소</label><input v-model="form.address" /></div>
        <div class="form-row"><label>메모</label><textarea v-model="form.memo" /></div>
        <div class="actions">
          <button type="submit">{{ form.id ? '저장' : '등록' }}</button>
          <button type="button" class="ghost" @click="close">취소</button>
        </div>
      </form>
    </aside>
    <CatalogPicker v-model:open="catalogOpen" :owned-ids="ownedCatalogIds" @imported="load" />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { isShown, typeIds } from '../filters';
import { CATEGORY, categoryLabel } from '../labels';
import MapPicker from '../components/MapPicker.vue';
import TypeFilters from '../components/TypeFilters.vue';
import CatalogPicker from '../components/CatalogPicker.vue';

const places = ref([]);
const catalogOpen = ref(false);
const ownedCatalogIds = computed(() => places.value.map((x) => x.catalogId).filter(Boolean));
const query = ref('');
const categoryOptions = Object.entries(CATEGORY).map(([id, label]) => ({ id, label }));
const categories = ref(typeIds(categoryOptions));
const open = ref(false);
const form = reactive(empty());

function empty() {
  return { id: null, name: '', category: 'FOOD', lat: null, lng: null, address: '', memo: '' };
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return places.value.filter((place) => {
    const catOk = isShown(categories.value, place.category, typeIds(categoryOptions));
    const text = `${place.name} ${place.address || ''}`.toLowerCase();
    return catOk && (!q || text.includes(q));
  });
});

function reset() {
  Object.assign(form, empty());
}

function openCreate() {
  reset();
  open.value = true;
}

function close() {
  open.value = false;
  reset();
}

async function load() {
  places.value = await api.places.list();
}

async function save() {
  const body = { ...form };
  delete body.id;
  if (form.id) await api.places.update(form.id, body);
  else await api.places.create(body);
  close();
  await load();
}

function applyPick(place) {
  form.lat = place.lat;
  form.lng = place.lng;
  if (place.address) form.address = place.address;
  if (place.name && !form.name) form.name = place.name;
}

function edit(place) {
  Object.assign(form, place);
  open.value = true;
}

async function remove(place) {
  if (!confirm(`‘${place.name}’ 장소를 삭제할까요?`)) return;
  await api.places.remove(place.id);
  await load();
}

onMounted(load);
</script>
