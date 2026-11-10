<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">관리자</p>
        <h2>운영 기록</h2>
        <p class="lead">운영자가 한 작업(정지·삭제·권한 변경·관광지 등록 등)이 자동으로 남습니다. 지울 수 없는 기록이에요.</p>
      </div>
      <button type="button" class="ghost" :disabled="loading" @click="load">새로고침</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <div class="panel">
      <div class="toolbar">
        <input v-model.trim="search" class="search" placeholder="운영자·대상 이메일 검색" @input="onSearch" />
        <select v-model="group" class="filter-select" @change="reset">
          <option value="">모든 작업</option>
          <option value="user.">사용자 관리</option>
          <option value="admin.">관리자 권한</option>
          <option value="catalog.">관광지 카탈로그</option>
        </select>
        <button type="button" class="ghost sm" :disabled="busy || !total" @click="exportCsv">CSV 내보내기</button>
        <span class="count">{{ total.toLocaleString('ko-KR') }}건</span>
      </div>

      <table class="data">
        <thead>
          <tr><th>시각</th><th>운영자</th><th>작업</th><th>대상</th><th>상세</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td class="num">{{ fmtDateTime(a.createdAt) }}</td>
            <td>{{ a.adminEmail || '-' }}</td>
            <td><span class="badge" :class="actionClass(a.action)">{{ ACTION_LABELS[a.action] || a.action }}</span></td>
            <td>{{ a.targetEmail || '-' }}</td>
            <td class="muted">{{ detailText(a) }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="empty">{{ loading ? '불러오는 중…' : '기록이 없습니다.' }}</td>
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
import { fmtDateTime } from '../adminFormat';
import { downloadCsv, toCsv } from '../adminCsv';
import { countryLabel } from '../countries';

const PAGE_SIZE = 30;
const ACTION_LABELS = {
  'user.ban': '계정 정지',
  'user.unban': '정지 해제',
  'user.update': '사용자 정보 수정',
  'user.delete': '계정 삭제',
  'user.create': '계정 추가',
  'user.password_set': '비밀번호 변경·초기화',
  'user.password_force': '비밀번호 변경 요구',
  'admin.grant': '관리자 지정',
  'admin.revoke': '관리자 해제',
  'catalog.create': '관광지 등록',
  'catalog.update': '관광지 수정',
  'catalog.delete': '관광지 삭제'
};

const rows = ref([]);
const total = ref(0);
const page = ref(0);
const search = ref('');
const group = ref('');
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
let timer = null;

const actionClass = (a) => (/delete|ban$/.test(a) && a !== 'user.unban' ? 'danger' : a.startsWith('admin.') ? 'ev-admin' : a.startsWith('catalog.') ? 'warn' : 'ev-login');

function detailText(a) {
  const d = a.detail || {};
  if (a.action === 'user.ban') return [d.until ? `${fmtDateTime(d.until)} 까지` : '무기한', d.reason && `사유: ${d.reason}`].filter(Boolean).join(' · ');
  if (a.action === 'user.update') return [d.emailChanged ? '이메일 변경' : '', d.confirmed === false ? '인증 해제' : ''].filter(Boolean).join(' · ') || '정보 수정';
  if (a.action === 'user.password_set') return d.forceChange ? '다음 로그인 때 변경 요구' : '변경 요구 없음';
  if (a.action === 'user.password_force') return d.forceChange ? '변경 요구 켬' : '변경 요구 끔';
  if (a.action === 'user.create') return d.admin ? '관리자 권한으로 생성' : '';
  if (a.action.startsWith('catalog.')) return [d.name, d.country && countryLabel(d.country), d.city].filter(Boolean).join(' · ');
  return '';
}

async function fetchPage(offset, limit) {
  return adminApi.audit({ action: group.value, search: search.value, limit, offset });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetchPage(page.value * PAGE_SIZE, PAGE_SIZE);
    rows.value = res.rows;
    total.value = res.total;
  } catch (e) {
    error.value = /admin_list_audit|function/i.test(e.message)
      ? '운영 기록 함수가 없습니다. supabase/migrations/0004_catalog_insights.sql 을 실행해 주세요.'
      : e.message;
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
function go(n) {
  page.value = n;
  load();
}

async function exportCsv() {
  busy.value = true;
  try {
    const all = [];
    for (let offset = 0; offset < 5000; offset += 200) {
      const res = await fetchPage(offset, 200);
      all.push(...res.rows);
      if (all.length >= res.total || !res.rows.length) break;
    }
    downloadCsv(
      `운영기록_${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(all, [
        { label: '시각', value: (r) => fmtDateTime(r.createdAt) },
        { label: '운영자', key: 'adminEmail' },
        { label: '작업', value: (r) => ACTION_LABELS[r.action] || r.action },
        { label: '대상', key: 'targetEmail' },
        { label: '상세', value: (r) => detailText(r) }
      ])
    );
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
