<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠 / 바우처</p>
        <h2>바우처</h2>
        <p class="lead">항공·호텔·티켓 텍스트를 저장하면 앱에서 오프라인으로 볼 수 있습니다.</p>
      </div>
      <button type="button" @click="openCreate">바우처 등록</button>
    </div>

    <div class="panel">
      <div class="toolbar">
        <select v-model.number="tripFilter" style="max-width: 220px">
          <option :value="0">모든 여행</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
        </select>
        <TypeFilters v-model="types" :options="typeOptions" />
        <input v-model="query" class="search" placeholder="제목, 내용 검색" />
        <span class="count">{{ filtered.length }}건</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>유형</th>
            <th>제목</th>
            <th>여행</th>
            <th>내용</th>
            <th class="right">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="voucher in filtered" :key="voucher.id">
            <td><span class="badge" :class="voucher.type.toLowerCase()">{{ voucherLabel(voucher.type) }}</span></td>
            <td><strong>{{ voucher.title }}</strong></td>
            <td>{{ tripTitle(voucher.tripId) }}</td>
            <td><pre class="clip muted">{{ voucher.body }}</pre></td>
            <td class="right">
              <div class="row-actions">
                <button type="button" class="ghost sm" @click="edit(voucher)">수정</button>
                <button type="button" class="danger sm" @click="remove(voucher)">삭제</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="5" class="empty">등록된 바우처가 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="open" class="drawer-backdrop" @click="close"></div>
    <aside v-if="open" class="drawer">
      <header>
        <h3>{{ form.id ? '바우처 수정' : '바우처 등록' }}</h3>
        <button type="button" class="ghost sm" @click="close">닫기</button>
      </header>
      <form @submit.prevent="save">
        <div class="form-row">
          <label>여행</label>
          <select v-model.number="form.tripId" required>
            <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
          </select>
        </div>
        <div class="form-row"><label>제목</label><input v-model="form.title" required /></div>
        <div class="form-row">
          <label>유형</label>
          <select v-model="form.type">
            <option value="FLIGHT">항공</option>
            <option value="HOTEL">호텔</option>
            <option value="TICKET">티켓</option>
          </select>
        </div>
        <div class="form-row"><label>내용</label><textarea v-model="form.body" required /></div>
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
import { VOUCHER, voucherLabel } from '../labels';
import TypeFilters from '../components/TypeFilters.vue';

const trips = ref([]);
const vouchers = ref([]);
const query = ref('');
const tripFilter = ref(0);
const typeOptions = Object.entries(VOUCHER).map(([id, label]) => ({ id, label }));
const types = ref(typeIds(typeOptions));
const open = ref(false);
const form = reactive(empty());

function empty() {
  return { id: null, tripId: 0, title: '', type: 'FLIGHT', body: '' };
}

function tripTitle(id) {
  return trips.value.find((trip) => trip.id === id)?.title || '-';
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return vouchers.value.filter((item) => {
    const tripOk = !tripFilter.value || item.tripId === tripFilter.value;
    const typeOk = isShown(types.value, item.type, typeIds(typeOptions));
    const text = `${item.title} ${item.body}`.toLowerCase();
    return tripOk && typeOk && (!q || text.includes(q));
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

function edit(voucher) {
  Object.assign(form, voucher);
  open.value = true;
}

async function load() {
  trips.value = await api.trips.list();
  if (!form.tripId && trips.value[0]) form.tripId = trips.value[0].id;
  vouchers.value = await api.vouchers.list();
}

async function save() {
  const body = { tripId: form.tripId, title: form.title, type: form.type, body: form.body };
  if (form.id) await api.vouchers.update(form.id, body);
  else await api.vouchers.create(body);
  close();
  await load();
}

async function remove(voucher) {
  if (!confirm(`‘${voucher.title}’ 바우처를 삭제할까요?`)) return;
  await api.vouchers.remove(voucher.id);
  await load();
}

onMounted(load);
</script>
