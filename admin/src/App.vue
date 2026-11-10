<template>
  <RouterView v-if="route.meta.public" />

  <div v-else class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">HG</span>
        <div>
          <strong>Honeymoon Guide</strong>
          <span>운영 콘솔</span>
        </div>
      </div>

      <p class="nav-group">운영</p>
      <nav>
        <RouterLink to="/" active-class="" exact-active-class="router-link-active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
          운영 대시보드
        </RouterLink>
        <RouterLink to="/insights">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/></svg>
          인사이트
        </RouterLink>
        <RouterLink to="/users">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.5c2 .7 3.5 2.6 3.5 5.5"/></svg>
          사용자 관리
        </RouterLink>
        <RouterLink to="/logs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 4h12v16H6V4Z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>
          접속 로그
        </RouterLink>
        <RouterLink to="/audit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3Z"/><path d="M9 12l2 2 4-4"/></svg>
          운영 기록
        </RouterLink>
      </nav>

      <p class="nav-group">콘텐츠</p>
      <nav>
        <RouterLink to="/catalog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>
          관광지 관리
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <span class="env">{{ isLocal ? 'LOCAL' : 'LIVE' }}</span>
        <span>Supabase</span>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-title">{{ route.meta.title || '운영 콘솔' }}</div>
        <div class="topbar-user">
          <span class="badge ev-admin">운영자</span>
          <span class="topbar-meta">{{ session?.user?.email }}</span>
          <RouterLink class="btn ghost sm" to="/password">비밀번호 변경</RouterLink>
          <button type="button" class="ghost sm" @click="logout">로그아웃</button>
        </div>
      </header>
      <main class="page">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { session, signOut } from './auth';

const route = useRoute();
const router = useRouter();
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

async function logout() {
  await signOut();
  router.replace('/login');
}
</script>
