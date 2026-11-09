<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb"><RouterLink to="/trips">여행 계획</RouterLink> / 새로 만들기</p>
        <h2>새 여행 계획</h2>
        <p class="lead">이름·국가·기간만 넣으면 일차가 자동으로 만들어집니다. 도시는 따로 적어도 됩니다.</p>
      </div>
    </div>

    <p v-if="error" class="flash" style="background:#fef2f2;color:#991b1b">{{ error }}</p>

    <form class="create-box" @submit.prevent="save">
      <div class="form-row">
        <label>여행 이름</label>
        <input v-model="form.title" required placeholder="예: 스페인 신혼여행" />
      </div>
      <div class="form-row">
        <label>국가</label>
        <CountrySelect v-model="form.country" />
        <p class="muted">스페인·포르투갈처럼 여러 나라를 함께 고를 수 있습니다.</p>
      </div>
      <div class="form-row">
        <label>도시·지역</label>
        <input v-model="form.destination" placeholder="예: 바르셀로나, 세비야, 리스본" />
        <p class="muted">국가와 별개로, 실제로 머무를 도시나 지역을 적습니다.</p>
      </div>
      <div class="grid two">
        <div class="form-row">
          <label>시작일</label>
          <input v-model="form.startDate" type="date" required />
        </div>
        <div class="form-row">
          <label>종료일</label>
          <input v-model="form.endDate" type="date" required />
        </div>
      </div>
      <p class="muted">
        {{ days ? `${days}일간의 일차 탭이 생성됩니다.` : '시작일과 종료일을 선택하세요.' }}
      </p>
      <div class="actions" style="margin-top: 16px">
        <button type="submit" :disabled="saving">{{ saving ? '만드는 중…' : '계획 만들기' }}</button>
        <RouterLink class="btn ghost" to="/trips">취소</RouterLink>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { daySpan, parseCountries } from '../labels';
import CountrySelect from '../components/CountrySelect.vue';

const router = useRouter();
const saving = ref(false);
const error = ref('');
const form = reactive({
  title: '',
  destination: '',
  country: 'ES',
  startDate: '',
  endDate: ''
});

const days = computed(() => daySpan(form.startDate, form.endDate));

async function save() {
  error.value = '';
  if (!parseCountries(form.country).length) {
    error.value = '국가를 하나 이상 선택하세요.';
    return;
  }
  if (days.value <= 0) {
    error.value = '종료일은 시작일 이후여야 합니다.';
    return;
  }
  saving.value = true;
  try {
    const trip = await api.trips.create({ ...form });
    await router.push(`/trips/${trip.id}?tab=days`);
  } catch (err) {
    error.value = err.response?.data?.message || err.message || '저장에 실패했습니다.';
  } finally {
    saving.value = false;
  }
}
</script>
