<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠 / 회화</p>
        <h2>상황별 회화</h2>
        <p class="lead">앱에서 TTS로 재생할 문장을 여행별로 관리합니다.</p>
      </div>
      <button type="button" @click="openCreate">문장 등록</button>
    </div>

    <div class="panel">
      <div class="toolbar">
        <select v-model.number="tripFilter" style="max-width: 220px">
          <option :value="0">모든 여행</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
        </select>
        <TypeFilters v-model="locales" :options="localeOptions" />
        <input v-model="query" class="search" placeholder="상황, 한국어, 현지어 검색" />
        <span class="count">{{ filtered.length }}건</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>상황</th>
            <th>한국어</th>
            <th>현지어</th>
            <th>로케일</th>
            <th>여행</th>
            <th class="right">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="phrase in filtered" :key="phrase.id">
            <td><strong>{{ phrase.situation }}</strong></td>
            <td>{{ phrase.ko }}</td>
            <td>{{ phrase.localText }}</td>
            <td class="num">{{ phrase.locale }}</td>
            <td>{{ tripTitle(phrase.tripId) }}</td>
            <td class="right">
              <div class="row-actions">
                <button type="button" class="ghost sm" @click="edit(phrase)">수정</button>
                <button type="button" class="danger sm" @click="remove(phrase)">삭제</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="6" class="empty">등록된 회화가 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="open" class="drawer-backdrop" @click="close"></div>
    <aside v-if="open" class="drawer">
      <header>
        <h3>{{ form.id ? '회화 수정' : '회화 등록' }}</h3>
        <button type="button" class="ghost sm" @click="close">닫기</button>
      </header>
      <form @submit.prevent="save">
        <div class="form-row">
          <label>여행</label>
          <select v-model.number="form.tripId" required>
            <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.title }}</option>
          </select>
        </div>
        <div class="form-row"><label>상황</label><input v-model="form.situation" required /></div>
        <div class="form-row"><label>한국어</label><input v-model="form.ko" required /></div>
        <div class="form-row"><label>현지어</label><input v-model="form.localText" required /></div>
        <div class="form-row">
          <label>로케일</label>
          <select v-model="form.locale">
            <option v-for="item in SPEECH_LOCALES" :key="item.id" :value="item.id">{{ item.label }} ({{ item.id }})</option>
          </select>
        </div>
        <div class="actions">
          <button type="submit">저장</button>
          <button type="button" class="ghost" @click="close">취소</button>
        </div>
      </form>
    </aside>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api';
import { isShown, typeIds } from '../filters';
import { countryLocale, SPEECH_LOCALES } from '../labels';
import TypeFilters from '../components/TypeFilters.vue';

const trips = ref([]);
const phrases = ref([]);
const query = ref('');
const tripFilter = ref(0);
const localeOptions = computed(() => {
  const labels = Object.fromEntries(SPEECH_LOCALES.map((item) => [item.id, item.label]));
  return [...new Set(phrases.value.map((item) => item.locale))].map((id) => ({
    id,
    label: labels[id] || id
  }));
});
const locales = ref([]);
const open = ref(false);
const form = reactive(empty());

function empty() {
  return { id: null, tripId: 0, situation: '', ko: '', localText: '', locale: 'en-GB' };
}

function tripTitle(id) {
  return trips.value.find((trip) => trip.id === id)?.title || '-';
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return phrases.value.filter((item) => {
    const tripOk = !tripFilter.value || item.tripId === tripFilter.value;
    const localeOk = isShown(locales.value, item.locale, typeIds(localeOptions.value));
    const text = `${item.situation} ${item.ko} ${item.localText}`.toLowerCase();
    return tripOk && localeOk && (!q || text.includes(q));
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

function edit(phrase) {
  Object.assign(form, phrase);
  open.value = true;
}

async function load() {
  trips.value = await api.trips.list();
  if (!form.tripId && trips.value[0]) form.tripId = trips.value[0].id;
  phrases.value = await api.phrases.list();
}

async function save() {
  const body = {
    tripId: form.tripId,
    situation: form.situation,
    ko: form.ko,
    localText: form.localText,
    locale: form.locale
  };
  if (form.id) await api.phrases.update(form.id, body);
  else await api.phrases.create(body);
  close();
  await load();
}

async function remove(phrase) {
  if (!confirm(`‘${phrase.situation}’ 문장을 삭제할까요?`)) return;
  await api.phrases.remove(phrase.id);
  await load();
}

watch(() => form.tripId, (id) => {
  if (form.id) return;
  const trip = trips.value.find((item) => item.id === id);
  if (trip) form.locale = countryLocale(trip.country);
});

onMounted(load);
</script>
