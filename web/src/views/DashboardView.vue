<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">개요</p>
        <h2>내 여행 홈</h2>
        <p class="lead">여행 콘텐츠를 등록하면 앱 일정·지도·티켓·회화·준비물에 바로 반영됩니다.</p>
      </div>
      <RouterLink class="btn" to="/trips/new">새 여행 계획</RouterLink>
    </div>

    <div class="stats">
      <article class="stat"><span>여행</span><b>{{ trips.length }}</b></article>
      <article class="stat"><span>장소</span><b>{{ places }}</b></article>
      <article class="stat"><span>바우처</span><b>{{ vouchers }}</b></article>
      <article class="stat"><span>회화</span><b>{{ phrases }}</b></article>
      <article class="stat"><span>준비물</span><b>{{ packing }}</b></article>
    </div>

    <div class="panel">
      <div class="toolbar">
        <strong>등록된 여행</strong>
        <span class="count">{{ trips.length }}건</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>여행</th>
            <th>도시·지역</th>
            <th>국가</th>
            <th>기간</th>
            <th class="right">일차</th>
            <th class="right">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="trip in trips" :key="trip.id">
            <td><strong>{{ trip.title }}</strong></td>
            <td>{{ trip.destination || '-' }}</td>
            <td><span class="badge country">{{ countryLabels(trip.country) }}</span></td>
            <td class="num">{{ trip.startDate }} ~ {{ trip.endDate }}</td>
            <td class="right num">{{ trip.dayCount }}일</td>
            <td class="right">
              <div class="row-actions">
                <RouterLink class="btn sm" :to="`/trips/${trip.id}`">조회</RouterLink>
                <RouterLink class="btn ghost sm" :to="`/trips/${trip.id}?tab=days`">편집</RouterLink>
              </div>
            </td>
          </tr>
          <tr v-if="!trips.length">
            <td colspan="6" class="empty">등록된 여행이 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { countryLabels } from '../labels';

const trips = ref([]);
const places = ref(0);
const vouchers = ref(0);
const phrases = ref(0);
const packing = ref(0);

onMounted(async () => {
  const [tripList, placeList, voucherList, phraseList, packingList] = await Promise.all([
    api.trips.list(),
    api.places.list(),
    api.vouchers.list(),
    api.phrases.list(),
    api.packing.list()
  ]);
  trips.value = tripList;
  places.value = placeList.length;
  vouchers.value = voucherList.length;
  phrases.value = phraseList.length;
  packing.value = packingList.length;
});
</script>
