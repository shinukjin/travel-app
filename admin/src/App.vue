<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">HG</span>
        <div>
          <strong>Honeymoon</strong>
          <span>Admin Console</span>
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

      <p class="nav-group">도구</p>
      <nav>
        <a href="http://localhost:8081" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>
          앱 미리보기
        </a>
        <a href="http://localhost:8080/h2-console" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>
          H2 콘솔
        </a>
      </nav>

      <div class="sidebar-foot">
        <span class="env">LOCAL</span>
        <span>API :8080</span>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-title">{{ route.meta.title || 'Admin' }}</div>
        <div class="topbar-meta">인증 없음 · 개발 환경</div>
      </header>
      <main class="page">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
</script>
