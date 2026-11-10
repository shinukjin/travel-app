<template>
  <RouterView v-if="route.meta.public" />

  <div v-else class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">HG</span>
        <div>
          <strong>Honeymoon Guide</strong>
          <span>여행 준비 웹</span>
        </div>
      </div>

      <p class="nav-group">콘텐츠</p>
      <nav>
        <RouterLink to="/" active-class="" exact-active-class="router-link-active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
          대시보드
        </RouterLink>
        <RouterLink to="/trips">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V5h16v14H4Z"/><path d="M8 9h8M8 13h5"/></svg>
          여행 계획
        </RouterLink>
        <RouterLink to="/places">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>
          장소
        </RouterLink>
        <RouterLink to="/vouchers">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h16v10H4V8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>
          바우처
        </RouterLink>
        <RouterLink to="/phrases">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 6h14v9H8l-3 3V6Z"/></svg>
          회화
        </RouterLink>
        <RouterLink to="/packing">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 7h10v12H7V7Z"/><path d="M9 7V5h6v2M9 12h6"/></svg>
          준비물
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <span class="env">{{ isLocal ? 'LOCAL' : 'LIVE' }}</span>
        <span>Supabase</span>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-title">{{ route.meta.title || '여행 가이드' }}</div>
        <div class="topbar-user">
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
