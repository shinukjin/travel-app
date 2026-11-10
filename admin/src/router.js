import { createRouter, createWebHistory } from 'vue-router';
import { authReady, isAdmin, mustChangePassword, session } from './auth';
import LoginView from './views/LoginView.vue';
import AdminDashboardView from './views/AdminDashboardView.vue';
import AdminUsersView from './views/AdminUsersView.vue';
import AdminLogsView from './views/AdminLogsView.vue';
import AdminInsightsView from './views/AdminInsightsView.vue';
import AdminAuditView from './views/AdminAuditView.vue';
import AdminCatalogView from './views/AdminCatalogView.vue';
import PasswordView from './views/PasswordView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { title: '로그인', public: true } },
    { path: '/', component: AdminDashboardView, meta: { title: '운영 대시보드' } },
    { path: '/users', component: AdminUsersView, meta: { title: '사용자 관리' } },
    { path: '/logs', component: AdminLogsView, meta: { title: '접속 로그' } },
    { path: '/insights', component: AdminInsightsView, meta: { title: '인사이트' } },
    { path: '/audit', component: AdminAuditView, meta: { title: '운영 기록' } },
    { path: '/catalog', component: AdminCatalogView, meta: { title: '관광지 관리' } },
    { path: '/password', component: PasswordView, meta: { title: '비밀번호 변경' } },
    // 예전 주소(/admin/...)로 들어와도 이어지도록
    { path: '/admin', redirect: '/' },
    { path: '/admin/users', redirect: '/users' },
    { path: '/admin/logs', redirect: '/logs' },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

// 로그인한 관리자만 들어올 수 있다. (실제 데이터 보호는 DB 의 admin_* 함수가 한 번 더 막는다)
router.beforeEach(async (to) => {
  await authReady();
  const ok = !!session.value && isAdmin.value;
  if (to.meta.public) return ok && to.path === '/login' ? { path: '/' } : true;
  if (!ok) return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
  // 임시 비밀번호로 들어왔다면 새 비밀번호를 정하기 전에는 다른 화면으로 못 간다
  if (mustChangePassword.value && to.path !== '/password') return { path: '/password' };
  return true;
});

export default router;
