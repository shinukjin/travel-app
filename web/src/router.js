import { createRouter, createWebHistory } from 'vue-router';
import { authReady, mustChangePassword, session } from './auth';
import LoginView from './views/LoginView.vue';
import DashboardView from './views/DashboardView.vue';
import TripsView from './views/TripsView.vue';
import TripCreateView from './views/TripCreateView.vue';
import TripPlanView from './views/TripPlanView.vue';
import PlacesView from './views/PlacesView.vue';
import VouchersView from './views/VouchersView.vue';
import PhrasesView from './views/PhrasesView.vue';
import PackingView from './views/PackingView.vue';
import PasswordView from './views/PasswordView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { title: '로그인', public: true } },
    { path: '/', component: DashboardView, meta: { title: '대시보드' } },
    { path: '/trips', component: TripsView, meta: { title: '여행 계획' } },
    { path: '/trips/new', component: TripCreateView, meta: { title: '새 여행 계획' } },
    { path: '/trips/:id', component: TripPlanView, meta: { title: '여행 계획' } },
    {
      path: '/builder',
      redirect: (to) => (to.query.tripId ? `/trips/${to.query.tripId}?tab=days` : '/trips')
    },
    { path: '/places', component: PlacesView, meta: { title: '장소 관리' } },
    { path: '/vouchers', component: VouchersView, meta: { title: '바우처' } },
    { path: '/phrases', component: PhrasesView, meta: { title: '회화' } },
    { path: '/packing', component: PackingView, meta: { title: '준비물' } },
    { path: '/password', component: PasswordView, meta: { title: '비밀번호 변경' } }
  ]
});

// 로그인하지 않았다면 로그인 화면으로, 로그인했다면 로그인 화면은 건너뛴다.
router.beforeEach(async (to) => {
  await authReady();
  if (!to.meta.public && !session.value) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
  }
  if (to.path === '/login' && session.value) return { path: '/' };
  // 임시 비밀번호로 들어왔다면 새 비밀번호를 정하기 전에는 다른 화면으로 못 간다
  if (session.value && mustChangePassword.value && to.path !== '/password') return { path: '/password' };
  return true;
});

export default router;
