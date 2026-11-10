<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠 / 준비물</p>
        <h2>준비물</h2>
        <p class="lead">여권·충전기·상비약처럼 여행 전에 챙길 물건을 여행 계획에 적어 둡니다.</p>
      </div>
      <button type="button" @click="openCreate">준비물 등록</button>
    </div>

    <div class="panel">
      <div class="toolbar">
        <select v-model.number="tripFilter" style="max-width: 220px">
          <option :value="0">모든 여행</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
        </select>
        <button
          v-for="item in packedFilters"
          :key="item.id"
          type="button"
          class="filter-chip"
          :class="{ on: packed === item.id }"
          @click="packed = item.id"
        >
          {{ item.label }}
        </button>
        <TypeFilters v-model="categories" :options="categoryOptions" />
        <input v-model="query" class="search" placeholder="이름, 메모 검색" />
        <span class="count">{{ filtered.length }}건</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>챙김</th>
            <th>분류</th>
            <th>이름</th>
            <th>수량</th>
            <th>여행</th>
            <th>메모</th>
            <th class="right">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id">
            <td>
              <input type="checkbox" :checked="item.packed" @change="togglePacked(item)" />
            </td>
            <td><span class="badge" :class="item.category.toLowerCase()">{{ packingLabel(item.category) }}</span></td>
            <td><strong>{{ item.name }}</strong></td>
            <td class="num">{{ item.quantity }}</td>
            <td>{{ tripTitle(item.tripId) }}</td>
            <td class="muted">{{ item.note || '-' }}</td>
            <td class="right">
              <div class="row-actions">
                <button type="button" class="ghost sm" @click="edit(item)">수정</button>
                <button type="button" class="danger sm" @click="remove(item)">삭제</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="7" class="empty">등록된 준비물이 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="open" class="drawer-backdrop" @click="close"></div>
    <aside v-if="open" class="drawer">
      <header>
        <h3>{{ form.id ? '준비물 수정' : '준비물 등록' }}</h3>
        <button type="button" class="ghost sm" @click="close">닫기</button>
      </header>
      <form @submit.prevent="save">
        <div class="form-row">
          <label>여행</label>
          <select v-model.number="form.tripId" required>
            <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
          </select>
        </div>
        <div class="form-row"><label>이름</label><input v-model="form.name" required placeholder="여권, 충전기…" /></div>
        <div class="form-row">
          <label>분류</label>
          <select v-model="form.category">
            <option v-for="(label, id) in PACKING" :key="id" :value="id">{{ label }}</option>
          </select>
        </div>
        <div class="form-row"><label>수량</label><input v-model.number="form.quantity" type="number" min="1" /></div>
        <div class="form-row"><label>메모</label><input v-model="form.note" placeholder="기내 휴대, 유효기간 확인…" /></div>
        <label class="pack-check">
          <input v-model="form.packed" type="checkbox" />
          이미 챙김
        </label>
        <div class="actions">
          <button type="submit">저장</button>
          <button type="button" class="ghost" @click="close">취소</button>
        </div>
      </form>
    </aside>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { isShown, typeIds } from '../filters';
import { PACKING, packingLabel } from '../labels';
import TypeFilters from '../components/TypeFilters.vue';

const trips = ref([]);
const items = ref([]);
const query = ref('');
const tripFilter = ref(0);
const packed = ref('ALL');
const categoryOptions = Object.entries(PACKING).map(([id, label]) => ({ id, label }));
const categories = ref(typeIds(categoryOptions));
const packedFilters = [
  { id: 'ALL', label: '전부' },
  { id: 'OPEN', label: '아직' },
  { id: 'DONE', label: '챙김' }
];
const open = ref(false);
const form = reactive(empty());

function empty() {
  return { id: null, tripId: 0, name: '', category: 'DOCS', quantity: 1, note: '', packed: false, sortOrder: 0 };
}

function tripTitle(id) {
  return trips.value.find((trip) => trip.id === id)?.title || '-';
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter((item) => {
    const tripOk = !tripFilter.value || item.tripId === tripFilter.value;
    const catOk = isShown(categories.value, item.category, typeIds(categoryOptions));
    const packedOk = packed.value === 'ALL' || (packed.value === 'DONE') === !!item.packed;
    const text = `${item.name} ${item.note || ''}`.toLowerCase();
    return tripOk && catOk && packedOk && (!q || text.includes(q));
  });
});

function close() {
  open.value = false;
  Object.assign(form, empty(), { tripId: trips.value[0]?.id || 0 });
}

function openCreate() {
  close();
  open.value = true;
}

function edit(item) {
  Object.assign(form, item);
  open.value = true;
}

async function load() {
  trips.value = await api.trips.list();
  if (!form.tripId && trips.value[0]) form.tripId = trips.value[0].id;
  items.value = await api.packing.list();
}

function payload() {
  return {
    tripId: form.tripId,
    name: form.name,
    category: form.category,
    quantity: form.quantity || 1,
    note: form.note,
    packed: form.packed,
    sortOrder: form.sortOrder || 0
  };
}

async function save() {
  if (form.id) await api.packing.update(form.id, payload());
  else await api.packing.create(payload());
  close();
  await load();
}

async function togglePacked(item) {
  await api.packing.update(item.id, { ...item, packed: !item.packed });
  await load();
}

async function remove(item) {
  if (!confirm(`‘${item.name}’ 준비물을 삭제할까요?`)) return;
  await api.packing.remove(item.id);
  await load();
}

onMounted(load);
</script>
