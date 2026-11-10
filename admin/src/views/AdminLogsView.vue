<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">관리자</p>
        <h2>접속 로그</h2>
        <p class="lead">가입·로그인·앱 실행 기록입니다. 접속 IP는 서버가 받은 요청 정보 기준이며, 없을 수도 있어요.</p>
      </div>
      <button type="button" class="ghost" :disabled="loading" @click="load">새로고침</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <div class="panel">
      <div class="toolbar">
        <input v-model.trim="search" class="search" placeholder="이메일 검색" @input="onSearch" />
        <select v-model="event" class="filter-select" @change="reset">
          <option value="">모든 이벤트</option>
          <option v-for="(label, id) in EVENT_LABELS" :key="id" :value="id">{{ label }}</option>
        </select>
        <select v-model="platform" class="filter-select" @change="reset">
          <option value="">모든 기기</option>
          <option v-for="(label, id) in PLATFORM_FILTERS" :key="id" :value="id">{{ label }}</option>
        </select>
        <button type="button" class="ghost sm" :disabled="exporting || !total" @click="exportCsv">CSV 내보내기</button>
        <span class="count">{{ total.toLocaleString('ko-KR') }}건</span>
      </div>

      <table class="data">
        <thead>
          <tr><th>시각</th><th>사용자</th><th>이벤트</th><th>기기</th><th>접속 IP</th><th>환경</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in rows" :key="l.id">
            <td class="num">{{ fmtDateTime(l.createdAt) }}</td>
            <td>{{ l.email }}</td>
            <td><span class="badge" :class="`ev-${l.event}`">{{ EVENT_LABELS[l.event] || l.event }}</span></td>
            <td>{{ PLATFORM_LABELS[l.platform] || l.platform }}</td>
            <td class="num">{{ l.ip || '-' }}</td>
            <td class="muted ellipsis" :title="l.device">{{ l.device || '-' }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="empty">{{ loading ? '불러오는 중…' : '기록이 없습니다.' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <button type="button" class="ghost sm" :disabled="page === 0 || loading" @click="go(page - 1)">이전</button>
        <span class="muted">{{ page + 1 }} / {{ pages }}</span>
        <button type="button" class="ghost sm" :disabled="page + 1 >= pages || loading" @click="go(page + 1)">다음</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '../adminApi';
import { EVENT_LABELS, PLATFORM_LABELS, fmtDateTime } from '../adminFormat';
import { downloadCsv, toCsv } from '../adminCsv';

const PAGE_SIZE = 30;
const PLATFORM_FILTERS = { android: 'Android', ios: 'iOS', web: '사용자 웹', 'web-admin': '운영 콘솔' };

const rows = ref([]);
const total = ref(0);
const page = ref(0);
const search = ref('');
const event = ref('');
const platform = ref('');
const loading = ref(false);
const error = ref('');
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

let timer = null;

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await adminApi.logs({
      event: event.value,
      platform: platform.value,
      search: search.value,
      limit: PAGE_SIZE,
      offset: page.value * PAGE_SIZE
    });
    rows.value = res.rows;
    total.value = res.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function reset() {
  page.value = 0;
  load();
}

function onSearch() {
  clearTimeout(timer);
  timer = setTimeout(reset, 300);
}

function go(next) {
  page.value = next;
  load();
}

/* ── CSV 내보내기 (현재 필터 조건 전체) ── */
const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  error.value = '';
  try {
    const all = [];
    for (let offset = 0; offset < 10000; offset += 200) {
      const res = await adminApi.logs({ event: event.value, platform: platform.value, search: search.value, limit: 200, offset });
      all.push(...res.rows);
      if (all.length >= res.total || !res.rows.length) break;
    }
    downloadCsv(
      `접속로그_${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(all, [
        { label: '시각', value: (r) => fmtDateTime(r.createdAt) },
        { label: '사용자', key: 'email' },
        { label: '이벤트', value: (r) => EVENT_LABELS[r.event] || r.event },
        { label: '기기', value: (r) => PLATFORM_LABELS[r.platform] || r.platform },
        { label: '접속 IP', key: 'ip' },
        { label: '환경', key: 'device' }
      ])
    );
  } catch (e) {
    error.value = e.message;
  } finally {
    exporting.value = false;
  }
}

onMounted(load);
</script>
