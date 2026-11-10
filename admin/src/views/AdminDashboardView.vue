<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">관리자</p>
        <h2>운영 대시보드</h2>
        <p class="lead">가입자와 접속 현황을 한눈에 확인합니다. (한국 시간 기준)</p>
      </div>
      <button type="button" class="ghost" :disabled="loading" @click="load">{{ loading ? '불러오는 중…' : '새로고침' }}</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <template v-if="data">
      <div class="kpis">
        <article class="kpi">
          <span>전체 가입자</span>
          <b>{{ n(data.totalUsers) }}</b>
          <small>오늘 +{{ n(data.newToday) }}</small>
        </article>
        <article class="kpi">
          <span>최근 7일 가입</span>
          <b>{{ n(data.new7d) }}</b>
          <small>30일 {{ n(data.new30d) }}명</small>
        </article>
        <article class="kpi">
          <span>오늘 접속자</span>
          <b>{{ n(data.activeToday) }}</b>
          <small>고유 사용자 기준</small>
        </article>
        <article class="kpi">
          <span>최근 7일 접속자</span>
          <b>{{ n(data.active7d) }}</b>
          <small>30일 {{ n(data.active30d) }}명</small>
        </article>
        <article class="kpi" :class="{ warn: data.bannedUsers > 0 }">
          <span>정지 계정</span>
          <b>{{ n(data.bannedUsers) }}</b>
          <RouterLink to="/users?status=banned">보기</RouterLink>
        </article>
        <article class="kpi" :class="{ warn: data.unconfirmedUsers > 0 }">
          <span>이메일 미인증</span>
          <b>{{ n(data.unconfirmedUsers) }}</b>
          <RouterLink to="/users?status=unconfirmed">보기</RouterLink>
        </article>
        <article class="kpi">
          <span>전체 여행 수</span>
          <b>{{ n(data.totalTrips) }}</b>
          <small>내용은 본인만 볼 수 있어요</small>
        </article>
        <article class="kpi">
          <span>관리자</span>
          <b>{{ n(data.admins) }}</b>
          <RouterLink to="/users?status=admin">보기</RouterLink>
        </article>
      </div>

      <div class="chart-grid">
        <div class="panel chart-panel">
          <div class="toolbar"><strong>일별 가입자</strong><span class="count">최근 30일</span></div>
          <div class="chart" role="img" aria-label="일별 가입자 막대 그래프">
            <div v-for="d in data.signupsDaily" :key="d.date" class="bar-col" :title="`${d.date} · ${d.count}명`">
              <div class="bar" :style="{ height: barHeight(d.count, maxSignups) }"></div>
            </div>
          </div>
          <div class="chart-axis"><span>{{ first(data.signupsDaily) }}</span><span>{{ last(data.signupsDaily) }}</span></div>
        </div>

        <div class="panel chart-panel">
          <div class="toolbar"><strong>일별 접속자</strong><span class="count">최근 30일 · 고유 사용자</span></div>
          <div class="chart" role="img" aria-label="일별 접속자 막대 그래프">
            <div v-for="d in data.activeDaily" :key="d.date" class="bar-col" :title="`${d.date} · ${d.count}명`">
              <div class="bar alt" :style="{ height: barHeight(d.count, maxActive) }"></div>
            </div>
          </div>
          <div class="chart-axis"><span>{{ first(data.activeDaily) }}</span><span>{{ last(data.activeDaily) }}</span></div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="panel">
          <div class="toolbar">
            <strong>최근 가입자</strong>
            <RouterLink class="count" to="/users">전체 보기</RouterLink>
          </div>
          <table class="data">
            <thead><tr><th>이메일</th><th class="right">가입</th></tr></thead>
            <tbody>
              <tr v-for="u in data.recentUsers" :key="u.id">
                <td>{{ u.email }}</td>
                <td class="right num">{{ fmtDateTime(u.createdAt) }}</td>
              </tr>
              <tr v-if="!data.recentUsers.length"><td colspan="2" class="empty">아직 가입자가 없습니다.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="toolbar">
            <strong>최근 접속</strong>
            <RouterLink class="count" to="/logs">전체 보기</RouterLink>
          </div>
          <table class="data">
            <thead><tr><th>사용자</th><th>이벤트</th><th class="right">시각</th></tr></thead>
            <tbody>
              <tr v-for="l in data.recentLogs" :key="l.id">
                <td>{{ l.email }}</td>
                <td><span class="badge" :class="`ev-${l.event}`">{{ EVENT_LABELS[l.event] || l.event }}</span> <span class="muted">{{ PLATFORM_LABELS[l.platform] || l.platform }}</span></td>
                <td class="right num">{{ fmtDateTime(l.createdAt) }}</td>
              </tr>
              <tr v-if="!data.recentLogs.length"><td colspan="3" class="empty">접속 기록이 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <p v-else-if="loading" class="empty">불러오는 중…</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '../adminApi';
import { EVENT_LABELS, PLATFORM_LABELS, fmtDateTime } from '../adminFormat';

const data = ref(null);
const loading = ref(false);
const error = ref('');

const n = (v) => Number(v || 0).toLocaleString('ko-KR');
const maxSignups = computed(() => Math.max(1, ...(data.value?.signupsDaily || []).map((d) => d.count)));
const maxActive = computed(() => Math.max(1, ...(data.value?.activeDaily || []).map((d) => d.count)));
const barHeight = (count, max) => `${count ? Math.max(6, Math.round((count / max) * 100)) : 2}%`;
const first = (rows) => (rows[0]?.date || '').slice(5);
const last = (rows) => (rows[rows.length - 1]?.date || '').slice(5);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    data.value = await adminApi.dashboard();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
