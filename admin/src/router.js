import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from './views/DashboardView.vue';
import TripsView from './views/TripsView.vue';
import TripCreateView from './views/TripCreateView.vue';
import TripPlanView from './views/TripPlanView.vue';
import PlacesView from './views/PlacesView.vue';
import VouchersView from './views/VouchersView.vue';
import PhrasesView from './views/PhrasesView.vue';
import PackingView from './views/PackingView.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
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
    { path: '/packing', component: PackingView, meta: { title: '준비물' } }
  ]
});
