<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠 / 여행 계획</p>
        <h2>여행 계획</h2>
        <p class="lead">새 여행을 만들면 일차가 생기고, 조회 화면에서 일정을 확인하거나 바로 편집할 수 있습니다.</p>
      </div>
      <RouterLink class="btn" to="/trips/new">새 여행 계획</RouterLink>
    </div>
    <p v-if="status" class="flash">{{ status }}</p>

    <div class="toolbar" style="margin-bottom: 14px; border: 1px solid var(--line); border-radius: 8px; background: white">
      <input v-model="query" class="search" placeholder="여행 이름, 여행지 검색" />
      <span class="count">{{ filtered.length }}건</span>
    </div>

    <div v-if="!filtered.length" class="empty-hero">
      <h3>아직 여행 계획이 없습니다</h3>
      <p class="muted">이름과 기간만 입력하면 처음부터 일정을 쌓을 수 있습니다.</p>
      <RouterLink class="btn" to="/trips/new">첫 계획 만들기</RouterLink>
    </div>

    <div v-else class="plan-cards">
      <article v-for="trip in filtered" :key="trip.id" class="plan-card">
        <div class="plan-card-top">
          <span class="badge country">{{ countryLabels(trip.country) }}</span>
          <span class="muted">{{ trip.dayCount }}일</span>
        </div>
        <h3>{{ trip.title }}</h3>
        <p class="muted">{{ trip.destination || '도시 미입력' }}</p>
        <p class="num">{{ formatRange(trip.startDate, trip.endDate) }}</p>
        <div class="row-actions" style="margin-top: 14px; justify-content: flex-start">
          <RouterLink class="btn sm" :to="`/trips/${trip.id}`">조회</RouterLink>
          <RouterLink class="btn ghost sm" :to="`/trips/${trip.id}?tab=days`">일정 편집</RouterLink>
          <button type="button" class="danger sm" @click="remove(trip)">삭제</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { countryLabel, countryLabels, formatRange } from '../labels';

const trips = ref([]);
const status = ref('');
const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return trips.value;
  return trips.value.filter((trip) =>
    [trip.title, trip.destination, trip.country, countryLabel(trip.country)].join(' ').toLowerCase().includes(q)
  );
});

async function load() {
  trips.value = await api.trips.list();
}

async function remove(trip) {
  if (!confirm(`‘${trip.title}’ 계획을 삭제할까요? 일차 일정도 함께 삭제됩니다.`)) return;
  await api.trips.remove(trip.id);
  status.value = '여행 계획을 삭제했습니다.';
  await load();
}

onMounted(load);
</script>
