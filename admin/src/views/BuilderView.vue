<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">콘텐츠 / 일정 빌더</p>
        <h2>일정 빌더</h2>
        <p class="lead">왼쪽 장소를 일차 타임라인으로 끌어다 놓고 저장하세요.</p>
      </div>
      <button v-if="selectedDay" type="button" @click="saveDay">이 일차 저장</button>
    </div>
    <p v-if="status" class="flash">{{ status }}</p>

    <div class="toolbar" style="margin-bottom: 14px; border: 1px solid var(--line); border-radius: 8px; background: white">
      <label style="margin: 0">여행</label>
      <select v-model.number="tripId" style="max-width: 320px" @change="loadTrip">
        <option :value="0">여행을 선택하세요</option>
        <option v-for="trip in trips" :key="trip.id" :value="trip.id">
          {{ trip.title }} · {{ trip.startDate }}
        </option>
      </select>
    </div>

    <div v-if="schedules.length" class="tabs">
      <button
        v-for="day in schedules"
        :key="day.id"
        :class="{ active: day.id === selectedDayId }"
        type="button"
        @click="selectedDayId = day.id"
      >
        {{ day.dayIndex }}일차 · {{ day.date }}
      </button>
    </div>

    <div v-if="selectedDay" class="workbench">
      <div class="panel">
        <h3>장소 카탈로그</h3>
        <div class="toolbar">
          <input v-model="placeQuery" class="search" placeholder="장소 검색" />
        </div>
        <draggable
          :list="visiblePlaces"
          :group="{ name: 'timeline', pull: 'clone', put: false }"
          :clone="clonePlace"
          item-key="id"
        >
          <template #item="{ element }">
            <div class="place-card">
              <span class="badge" :class="element.category.toLowerCase()">{{ categoryLabel(element.category) }}</span>
              <strong> {{ element.name }}</strong>
              <div class="muted">{{ element.address }}</div>
            </div>
          </template>
        </draggable>
        <p v-if="!visiblePlaces.length" class="empty">검색된 장소가 없습니다.</p>
      </div>

      <div class="panel">
        <div class="toolbar">
          <h3 style="padding: 0; border: 0">{{ selectedDay.dayIndex }}일차 타임라인</h3>
          <span class="count">{{ selectedDay.items.length }}개 일정</span>
        </div>
        <draggable v-model="selectedDay.items" group="timeline" item-key="_key" handle=".drag">
          <template #item="{ element, index }">
            <div class="timeline-card">
              <div class="trip-item">
                <strong class="drag" style="cursor: grab">{{ index + 1 }}. {{ element.place?.name || element.name }}</strong>
                <button type="button" class="ghost sm" @click="selectedDay.items.splice(index, 1)">제거</button>
              </div>
              <div class="form-row" style="margin-top: 8px">
                <label>시각</label>
                <input v-model="element.startTime" type="time" />
              </div>
              <div class="form-row">
                <label>메모</label>
                <input v-model="element.note" placeholder="예약 번호, 입장 팁 등" />
              </div>
            </div>
          </template>
        </draggable>
        <p v-if="!selectedDay.items.length" class="drop-hint">왼쪽 카드를 이 영역으로 드롭하세요.</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import draggable from 'vuedraggable';
import { api } from '../api';
import { categoryLabel } from '../labels';

const route = useRoute();
const trips = ref([]);
const places = ref([]);
const schedules = ref([]);
const tripId = ref(0);
const selectedDayId = ref(0);
const status = ref('');
const placeQuery = ref('');

const selectedDay = computed(() => schedules.value.find((day) => day.id === selectedDayId.value));
const visiblePlaces = computed(() => {
  const q = placeQuery.value.trim().toLowerCase();
  if (!q) return places.value;
  return places.value.filter((place) => `${place.name} ${place.address || ''}`.toLowerCase().includes(q));
});

function clonePlace(place) {
  return {
    _key: `${place.id}-${Date.now()}`,
    placeId: place.id,
    place,
    name: place.name,
    startTime: '',
    note: ''
  };
}

async function load() {
  trips.value = await api.trips.list();
  places.value = await api.places.list();
  const fromQuery = Number(route.query.tripId || 0);
  if (fromQuery && trips.value.some((trip) => trip.id === fromQuery)) tripId.value = fromQuery;
  else if (trips.value.length) tripId.value = trips.value[0].id;
  if (tripId.value) await loadTrip();
}

async function loadTrip() {
  if (!tripId.value) return;
  schedules.value = (await api.trips.schedules(tripId.value)).map((day) => ({
    ...day,
    items: (day.items || []).map((item) => ({
      ...item,
      _key: item.id || `${item.place?.id}-${Math.random()}`,
      placeId: item.place?.id,
      startTime: item.startTime ? String(item.startTime).slice(0, 5) : ''
    }))
  }));
  selectedDayId.value = schedules.value[0]?.id || 0;
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
  day.items = saved.items.map((item) => ({
    ...item,
    _key: item.id,
    placeId: item.place?.id,
    startTime: item.startTime ? String(item.startTime).slice(0, 5) : ''
  }));
  status.value = `${day.dayIndex}일차 일정을 저장했습니다.`;
}

onMounted(load);
</script>
