import { supabase } from './supabase';
import { createDataApi } from './supabaseApi';

const data = createDataApi(supabase);

/**
 * 기존 Spring Boot REST API → Supabase 로 교체.
 * 호출부(api.trips(), api.createPacking() 등)는 그대로 두기 위해 예전 이름을 유지한다.
 */
export const api = {
  trips: () => data.trips.list(),
  createTrip: (body) => data.trips.create(body),
  updateTrip: (id, body) => data.trips.update(id, body),
  deleteTrip: (id) => data.trips.remove(id),
  schedules: (tripId) => data.trips.schedules(tripId),
  places: () => data.places.list(),
  createPlace: (body) => data.places.create(body),
  updatePlace: (id, body) => data.places.update(id, body),
  deletePlace: (id) => data.places.remove(id),
  replaceScheduleItems: (scheduleId, items) => data.schedules.saveItems(scheduleId, items),
  createVoucher: (body) => data.vouchers.create(body),
  createPhrase: (body) => data.phrases.create(body),
  vouchers: (tripId) => data.vouchers.list(tripId),
  phrases: (tripId) => data.phrases.list(tripId),
  packing: (tripId) => data.packing.list(tripId),
  createPacking: (body) => data.packing.create(body),
  updatePacking: (id, body) => data.packing.update(id, body),
  deletePacking: (id) => data.packing.remove(id),
  memos: (tripId) => data.memos.list(tripId),
  saveMemo: (body) => data.memos.save(body),
  deleteMemoByClientId: (clientId) => data.memos.removeByClientId(clientId),
  mediaLogs: (tripId) => data.mediaLogs.list(tripId),
  saveMediaLog: (body) => data.mediaLogs.create(body),
  deleteVoucher: (id) => data.vouchers.remove(id),
  deletePhrase: (id) => data.phrases.remove(id),
  // 공유 링크
  createSharedPlan: (body) => data.sharedPlans.create(body),
  mySharedPlans: () => data.sharedPlans.mine(),
  deleteSharedPlan: (id) => data.sharedPlans.remove(id),
  getSharedPlan: (token) => data.sharedPlans.get(token),
  // 관리자가 등록한 추천 관광지 (좌표 포함)
  catalogCountries: () => data.catalog.countries(),
  catalogSearch: (params) => data.catalog.search(params),
  catalogCities: (country) => data.catalog.cities(country),
  importCatalogPlace: (catalogId) => data.catalog.importPlace(catalogId)
};
