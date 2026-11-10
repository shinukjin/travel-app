import { Alert } from 'react-native';
import { api } from './api';
import { loadGuideCache, refreshGuideCache } from './sync';
import { storage } from './storage';

export const PLAN_KIND = 'honeymoon-guide-plan';
export const PLAN_VERSION = 1;
export const MARKER_BEGIN = '-----BEGIN HONEYMOON GUIDE-----';
export const MARKER_END = '-----END HONEYMOON GUIDE-----';

export function buildPortablePlan(trip, days, vouchers, phrases, packing, options) {
  const sortedDays = [...(days || [])].sort((a, b) => a.dayIndex - b.dayIndex);
  return {
    kind: PLAN_KIND,
    version: PLAN_VERSION,
    exportedAt: new Date().toISOString(),
    options: { ...options },
    trip: {
      title: trip.title,
      country: trip.country,
      destination: trip.destination || '',
      startDate: trip.startDate,
      endDate: trip.endDate
    },
    days: sortedDays.map((day) => ({
      dayIndex: day.dayIndex,
      date: day.date,
      title: day.title,
      items: (day.items || []).map((item, index) => ({
        sortOrder: item.sortOrder ?? index,
        startTime: item.startTime,
        note: item.note || '',
        place: item.place
          ? {
              name: item.place.name,
              category: item.place.category,
              lat: item.place.lat,
              lng: item.place.lng,
              address: item.place.address || '',
              memo: item.place.memo || ''
            }
          : null
      }))
    })),
    vouchers: (options?.vouchers ? vouchers || [] : []).map((row) => ({
      title: row.title,
      type: row.type,
      body: row.body || ''
    })),
    phrases: (options?.phrases ? phrases : []).map((row) => ({
      situation: row.situation,
      ko: row.ko,
      localText: row.localText,
      locale: row.locale
    })),
    packing: (options?.packing ? packing : []).map((row) => ({
      name: row.name,
      category: row.category,
      quantity: row.quantity ?? 1,
      note: row.note || '',
      packed: !!row.packed,
      sortOrder: row.sortOrder ?? 0
    }))
  };
}

export function wrapPortableText(plan) {
  const json = JSON.stringify(plan);
  return `${MARKER_BEGIN}\n${json}\n${MARKER_END}`;
}

export function extractPortablePlan(raw) {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  const start = text.indexOf(MARKER_BEGIN);
  const end = text.indexOf(MARKER_END);
  let body = text;
  if (start >= 0 && end > start) {
    body = text.slice(start + MARKER_BEGIN.length, end).trim();
  }
  try {
    const plan = JSON.parse(body);
    if (plan?.kind !== PLAN_KIND) return null;
    if (!plan.trip?.title || !plan.trip?.startDate || !plan.trip?.endDate) return null;
    return plan;
  } catch {
    return null;
  }
}

function placeKey(place) {
  return `${place.name}|${place.lat}|${place.lng}`;
}

async function resolvePlaceId(place, catalog) {
  if (!place?.name) throw new Error('장소 이름이 없습니다.');
  const found = catalog.find(
    (row) =>
      row.name === place.name &&
      (place.lat == null ||
        place.lng == null ||
        (Math.abs(row.lat - place.lat) < 0.0003 && Math.abs(row.lng - place.lng) < 0.0003))
  );
  if (found) return found.id;
  const created = await api.createPlace({
    name: place.name,
    category: place.category || 'SIGHT',
    lat: place.lat,
    lng: place.lng,
    address: place.address || '',
    memo: place.memo || ''
  });
  catalog.push(created);
  return created.id;
}

function normalizeTime(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length === 5) return `${s}:00`;
  return s;
}

export async function importPortablePlan(plan, { preferOnline = true } = {}) {
  if (!plan || plan.kind !== PLAN_KIND) {
    throw new Error('올바른 여행 계획 코드가 아닙니다.');
  }

  if (preferOnline) {
    try {
      return await importPortablePlanOnline(plan);
    } catch (error) {
      const offline = await importPortablePlanOffline(plan);
      if (offline) {
        Alert.alert(
          '오프라인 저장',
          '서버에 연결하지 못해 이 기기에만 저장했습니다. 백엔드가 켜진 뒤 다시 가져오면 동기화됩니다.'
        );
        return offline;
      }
      throw error;
    }
  }
  return importPortablePlanOffline(plan);
}

async function importPortablePlanOnline(plan) {
  const tripBody = {
    title: plan.trip.title,
    country: plan.trip.country || 'ES',
    destination: plan.trip.destination || '',
    startDate: plan.trip.startDate,
    endDate: plan.trip.endDate
  };
  const created = await api.createTrip(tripBody);
  const tripId = created.id;
  const schedules = await api.schedules(tripId);
  const catalog = await api.places();

  for (const day of plan.days || []) {
    const schedule = schedules.find((s) => s.date === day.date) || schedules.find((s) => s.dayIndex === day.dayIndex);
    if (!schedule) continue;
    const items = [];
    for (const row of day.items || []) {
      if (!row.place) continue;
      const placeId = await resolvePlaceId(row.place, catalog);
      items.push({
        placeId,
        sortOrder: row.sortOrder ?? items.length,
        startTime: normalizeTime(row.startTime),
        note: row.note || ''
      });
    }
    if (items.length) {
      await api.replaceScheduleItems(schedule.id, items);
    }
  }

  for (const row of plan.vouchers || []) {
    await api.createVoucher({ tripId, title: row.title, type: row.type, body: row.body || '' });
  }
  for (const row of plan.phrases || []) {
    await api.createPhrase({
      tripId,
      situation: row.situation,
      ko: row.ko,
      localText: row.localText,
      locale: row.locale || 'es-ES'
    });
  }
  for (const row of plan.packing || []) {
    await api.createPacking({
      tripId,
      name: row.name,
      category: row.category || 'OTHER',
      quantity: row.quantity ?? 1,
      note: row.note || '',
      packed: !!row.packed,
      sortOrder: row.sortOrder ?? 0
    });
  }

  await refreshGuideCache();
  return { tripId, mode: 'server' };
}

async function importPortablePlanOffline(plan) {
  const tripId = -Math.abs(Date.now());
  const trip = {
    id: tripId,
    title: plan.trip.title,
    country: plan.trip.country || 'ES',
    destination: plan.trip.destination || '',
    startDate: plan.trip.startDate,
    endDate: plan.trip.endDate,
    dayCount: (plan.days || []).length
  };
  const days = (plan.days || []).map((day, dIdx) => ({
    id: tripId - dIdx - 1,
    tripId,
    dayIndex: day.dayIndex,
    date: day.date,
    title: day.title || `${day.dayIndex}일차`,
    items: (day.items || []).map((item, i) => ({
      id: tripId * 100 - dIdx * 10 - i,
      sortOrder: item.sortOrder ?? i,
      startTime: item.startTime,
      note: item.note || '',
      place: item.place
        ? {
            id: -(Math.abs(placeKey(item.place).length) + i + dIdx),
            ...item.place
          }
        : null
    }))
  }));

  const cache = await loadGuideCache();
  await storage.setTrips([...cache.trips, trip]);
  await storage.setSchedules({ ...cache.schedules, [tripId]: days });
  await storage.setVouchers({
    ...cache.vouchers,
    [tripId]: (plan.vouchers || []).map((row, i) => ({ id: tripId * 10 - i, tripId, ...row }))
  });
  await storage.setPhrases({
    ...cache.phrases,
    [tripId]: (plan.phrases || []).map((row, i) => ({ id: tripId * 10 - i - 100, tripId, ...row }))
  });
  await storage.setPacking({
    ...cache.packing,
    [tripId]: (plan.packing || []).map((row, i) => ({ id: tripId * 10 - i - 200, tripId, ...row }))
  });

  return { tripId, mode: 'local' };
}

export function planSummary(plan) {
  if (!plan) return '';
  const days = plan.days?.length || 0;
  const stops = (plan.days || []).reduce((n, d) => n + (d.items?.length || 0), 0);
  return `${plan.trip.title} · ${plan.trip.startDate}~${plan.trip.endDate} · ${days}일 · 장소 ${stops}곳`;
}
