<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">관리자</p>
        <h2>인사이트</h2>
        <p class="lead">사용 현황을 합계·분포로 봅니다. 개별 사용자의 여행 내용은 포함되지 않아요. (최근 30일 · 한국 시간)</p>
      </div>
      <button type="button" class="ghost" :disabled="loading" @click="load">{{ loading ? '불러오는 중…' : '새로고침' }}</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <template v-if="d">
      <!-- 핵심 지표 -->
      <div class="kpis">
        <article class="kpi" :class="{ warn: d.dormantUsers > 0 }">
          <span>휴면 사용자</span>
          <b>{{ n(d.dormantUsers) }}</b>
          <RouterLink to="/users?status=dormant">30일 이상 미접속 · 보기</RouterLink>
        </article>
        <article class="kpi">
          <span>최근 7일 재방문</span>
          <b>{{ n(d.returningUsers7d) }}</b>
          <small>가입 7일 이후에도 다시 접속한 사용자</small>
        </article>
        <article class="kpi">
          <span>가입자당 평균 여행</span>
          <b>{{ d.avgTripsPerUser }}</b>
          <small>전체 여행 {{ n(d.content.trips) }}개</small>
        </article>
        <article class="kpi">
          <span>추천 관광지</span>
          <b>{{ n(d.catalog.active) }}</b>
          <small>{{ d.catalog.countries }}개국 · 사용자가 가져간 {{ n(d.catalog.imports) }}회</small>
        </article>
      </div>

      <!-- 사용 단계 -->
      <div class="panel insight-panel">
        <div class="toolbar"><strong>사용 단계별 사용자</strong><span class="count">가입자 대비 비율</span></div>
        <ul class="funnel">
          <li v-for="s in funnel" :key="s.label">
            <span class="funnel-label">{{ s.label }}</span>
            <div class="funnel-track"><div class="funnel-fill" :style="{ width: s.pct + '%' }"></div></div>
            <span class="funnel-num">{{ n(s.value) }}명 <small>{{ s.pct }}%</small></span>
          </li>
        </ul>
        <p class="insight-note">여행을 만들었지만 일정을 안 넣은 사용자가 많다면 홈의 일정 등록 안내·추천 관광지 노출을 늘려 볼 만해요.</p>
      </div>

      <div class="chart-grid">
        <div class="panel chart-panel">
          <div class="toolbar"><strong>시간대별 접속</strong><span class="count">0~23시</span></div>
          <div class="chart" role="img" aria-label="시간대별 접속 막대 그래프">
            <div v-for="(v, h) in d.hourly" :key="h" class="bar-col" :title="`${h}시 · ${v}회`">
              <div class="bar" :style="{ height: barHeight(v, maxHourly) }"></div>
            </div>
          </div>
          <div class="chart-axis chart-axis-hours"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div>
        </div>

        <div class="panel chart-panel">
          <div class="toolbar"><strong>요일별 접속</strong><span class="count">일~토</span></div>
          <div class="chart chart-wide" role="img" aria-label="요일별 접속 막대 그래프">
            <div v-for="(v, i) in d.weekday" :key="i" class="bar-col bar-col-labeled" :title="`${DAYS[i]}요일 · ${v}회`">
              <div class="bar alt" :style="{ height: barHeight(v, maxWeekday) }"></div>
              <span class="bar-label">{{ DAYS[i] }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="panel insight-panel">
          <div class="toolbar"><strong>기기별 접속</strong><span class="count">최근 30일 이벤트</span></div>
          <ul class="rank">
            <li v-for="p in platforms" :key="p.platform">
              <span class="rank-name">{{ PLATFORM_LABELS[p.platform] || p.platform }}</span>
              <div class="rank-track"><div class="rank-fill" :style="{ width: p.pct + '%' }"></div></div>
              <span class="rank-num">{{ n(p.count) }} <small>{{ p.pct }}%</small></span>
            </li>
            <li v-if="!platforms.length" class="muted">접속 기록이 없습니다.</li>
          </ul>
        </div>

        <div class="panel insight-panel">
          <div class="toolbar"><strong>콘텐츠 총량</strong><span class="count">모든 사용자 합계</span></div>
          <dl class="totals">
            <div v-for="t in totals" :key="t.label"><dt>{{ t.label }}</dt><dd>{{ n(t.value) }}</dd></div>
          </dl>
        </div>
      </div>

      <div class="chart-grid">
        <div class="panel insight-panel">
          <div class="toolbar"><strong>인기 여행 국가 Top 10</strong><span class="count">여행 수 기준</span></div>
          <ul class="rank">
            <li v-for="c in countries" :key="c.country">
              <span class="rank-name">{{ countryFlag(c.country) }} {{ countryLabel(c.country) }}</span>
              <div class="rank-track"><div class="rank-fill alt" :style="{ width: c.pct + '%' }"></div></div>
              <span class="rank-num">{{ n(c.count) }}</span>
            </li>
            <li v-if="!countries.length" class="muted">아직 여행이 없습니다.</li>
          </ul>
          <p class="insight-note">인기 국가부터 <RouterLink to="/catalog">관광지 카탈로그</RouterLink>를 채우면 사용자가 가장 먼저 도움을 받아요.</p>
        </div>

        <div class="panel insight-panel">
          <div class="toolbar"><strong>인기 목적지 Top 10</strong><span class="count">도시·지역 입력 기준</span></div>
          <ul class="rank">
            <li v-for="c in destinations" :key="c.destination">
              <span class="rank-name">{{ c.destination }}</span>
              <div class="rank-track"><div class="rank-fill alt" :style="{ width: c.pct + '%' }"></div></div>
              <span class="rank-num">{{ n(c.count) }}</span>
            </li>
            <li v-if="!destinations.length" class="muted">아직 목적지 정보가 없습니다.</li>
          </ul>
        </div>
      </div>
    </template>
    <p v-else-if="loading" class="empty">불러오는 중…</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '../adminApi';
import { PLATFORM_LABELS } from '../adminFormat';
import { countryFlag, countryLabel } from '../countries';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const d = ref(null);
const loading = ref(false);
const error = ref('');

const n = (v) => Number(v || 0).toLocaleString('ko-KR');
const barHeight = (v, max) => `${v ? Math.max(6, Math.round((v / max) * 100)) : 2}%`;
const maxHourly = computed(() => Math.max(1, ...(d.value?.hourly || [0])));
const maxWeekday = computed(() => Math.max(1, ...(d.value?.weekday || [0])));

const pctOf = (v, base) => (base ? Math.round((v / base) * 100) : 0);

const funnel = computed(() => {
  const f = d.value.funnel;
  const base = f.signedUp;
  return [
    { label: '가입', value: f.signedUp },
    { label: '이메일 인증', value: f.confirmed },
    { label: '여행 만들기', value: f.createdTrip },
    { label: '일정 등록', value: f.addedSchedule },
    { label: '준비물 사용', value: f.usedPacking },
    { label: '메모 작성', value: f.wroteMemo }
  ].map((s) => ({ ...s, pct: pctOf(s.value, base) }));
});

const platforms = computed(() => {
  const list = d.value.platforms;
  const sum = list.reduce((s, p) => s + p.count, 0);
  return list.map((p) => ({ ...p, pct: pctOf(p.count, sum) }));
});
const countries = computed(() => {
  const list = d.value.countries;
  const max = Math.max(1, ...list.map((c) => c.count));
  return list.map((c) => ({ ...c, pct: pctOf(c.count, max) }));
});
const destinations = computed(() => {
  const list = d.value.destinations;
  const max = Math.max(1, ...list.map((c) => c.count));
  return list.map((c) => ({ ...c, pct: pctOf(c.count, max) }));
});
const totals = computed(() => {
  const c = d.value.content;
  return [
    { label: '여행', value: c.trips },
    { label: '장소', value: c.places },
    { label: '일정 항목', value: c.scheduleItems },
    { label: '티켓', value: c.vouchers },
    { label: '회화', value: c.phrases },
    { label: '준비물', value: c.packingItems },
    { label: '메모', value: c.memos },
    { label: '사진 기록', value: c.mediaLogs }
  ];
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    d.value = await adminApi.insights();
  } catch (e) {
    error.value = /admin_insights|function/i.test(e.message)
      ? '인사이트 함수가 없습니다. supabase/migrations/0004_catalog_insights.sql 을 실행해 주세요.'
      : e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
