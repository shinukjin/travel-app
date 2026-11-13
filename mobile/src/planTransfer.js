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

/** 예전 방식(코드 붙여넣기) — 모든 항목을 새 여행으로 */
async function importPortablePlanOnline(plan) {
  const { tripId } = await applyPlan(plan, { parts: ALL_PARTS, mode: 'new' });
  return { tripId, mode: 'server' };
}

/* ---------- 가져오기 (링크·코드 공통) ---------- */

/** 가져올 수 있는 항목 */
export const PLAN_PARTS = [
  { id: 'schedule', label: '일정', unit: '곳' },
  { id: 'packing', label: '준비물', unit: '개' },
  { id: 'vouchers', label: '티켓·바우처', unit: '개' },
  { id: 'phrases', label: '회화', unit: '개' }
];
export const ALL_PARTS = { schedule: true, packing: true, vouchers: true, phrases: true };

/** 계획 안의 항목별 개수 — 가져오기 화면에서 어떤 항목이 들어 있는지 보여 준다 */
export function planCounts(plan) {
  return {
    schedule: (plan?.days || []).reduce((n, d) => n + (d.items || []).filter((i) => i.place).length, 0),
    packing: plan?.packing?.length || 0,
    vouchers: plan?.vouchers?.length || 0,
    phrases: plan?.phrases?.length || 0
  };
}

/**
 * 가져오기 방식
 *  new     새 여행으로 추가
 *  merge   내 여행에 합치기 — 이미 있는 장소·항목은 건너뛰고 없는 것만 더한다
 *  replace 내 여행에 덮어쓰기 — 선택한 항목의 기존 내용을 지우고 받은 내용으로 바꾼다
 */
export const APPLY_MODES = [
  { id: 'new', label: '새 여행으로 추가', hint: '내 여행은 그대로 두고, 받은 내용으로 새 여행을 만들어요.' },
  { id: 'merge', label: '내 여행에 합치기', hint: '이미 있는 것은 건너뛰고, 없는 것만 더해요.' },
  { id: 'replace', label: '내 여행에 덮어쓰기', hint: '선택한 항목의 기존 내용을 지우고 받은 내용으로 바꿔요.' }
];

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

async function applySchedule(plan, tripId, mode, report) {
  const schedules = await api.schedules(tripId);
  const catalog = await api.places();
  const planDays = plan.days || [];

  for (const schedule of schedules) {
    // 날짜가 달라도 "n일차"끼리 맞춘다
    const day = planDays.find((d) => d.dayIndex === schedule.dayIndex);
    const existing = (schedule.items || []).filter((i) => i.place?.id).map((i) => ({ placeId: i.place.id, startTime: i.startTime, note: i.note || '' }));

    if (!day) {
      // 받은 계획에 없는 날 — 덮어쓰기일 때만 비운다
      if (mode === 'replace' && existing.length) {
        await api.replaceScheduleItems(schedule.id, []);
        report.removed.schedule += existing.length;
      }
      continue;
    }

    const incoming = [];
    for (const row of day.items || []) {
      if (!row.place) continue;
      incoming.push({
        placeId: await resolvePlaceId(row.place, catalog),
        startTime: normalizeTime(row.startTime),
        note: row.note || ''
      });
    }

    let items = incoming;
    if (mode === 'merge') {
      const have = new Set(existing.map((i) => i.placeId));
      const fresh = incoming.filter((i) => !have.has(i.placeId));
      report.skipped.schedule += incoming.length - fresh.length;
      items = [...existing, ...fresh];
      report.added.schedule += fresh.length;
    } else {
      if (mode === 'replace') report.removed.schedule += existing.length;
      report.added.schedule += incoming.length;
    }
    if (items.length || mode === 'replace') await api.replaceScheduleItems(schedule.id, items);
  }
  // 내 여행이 받은 계획보다 짧으면 넘치는 날은 건너뛴다
  report.skippedDays = planDays.filter((d) => !schedules.some((s) => s.dayIndex === d.dayIndex)).length;
}

/** 티켓·회화·준비물처럼 목록형 항목 하나를 가져온다 */
async function applyList({ mode, key, rows, load, remove, create, same, report }) {
  let existing = [];
  if (mode !== 'new') existing = await load();
  if (mode === 'replace') {
    for (const row of existing) await remove(row.id);
    report.removed[key] += existing.length;
    existing = [];
  }
  for (const row of rows) {
    if (mode === 'merge' && existing.some((e) => same(e, row))) {
      report.skipped[key] += 1;
      continue;
    }
    await create(row);
    report.added[key] += 1;
  }
}

/**
 * 받은 계획을 적용한다.
 * parts: { schedule, packing, vouchers, phrases } 중 가져올 것만 true
 * mode: 'new' | 'merge' | 'replace' (merge·replace 는 targetTripId 필요)
 * 돌려주는 report 로 "무엇을 몇 개 더했고, 건너뛰었고, 지웠는지" 알려 줄 수 있다.
 */
export async function applyPlan(plan, { parts = ALL_PARTS, mode = 'new', targetTripId = null } = {}) {
  if (!plan || plan.kind !== PLAN_KIND) throw new Error('올바른 여행 계획이 아닙니다.');
  const zero = () => ({ schedule: 0, packing: 0, vouchers: 0, phrases: 0 });
  const report = { added: zero(), skipped: zero(), removed: zero(), skippedDays: 0 };

  let tripId = targetTripId;
  if (mode === 'new') {
    const created = await api.createTrip({
      title: plan.trip.title,
      country: plan.trip.country,
      destination: plan.trip.destination || '',
      startDate: plan.trip.startDate,
      endDate: plan.trip.endDate
    });
    tripId = created.id;
  }
  if (!tripId) throw new Error('적용할 여행을 선택해 주세요.');

  if (parts.schedule) await applySchedule(plan, tripId, mode, report);

  if (parts.vouchers) {
    await applyList({
      mode, key: 'vouchers', rows: plan.vouchers || [], report,
      load: () => api.vouchers(tripId),
      remove: (id) => api.deleteVoucher(id),
      create: (row) => api.createVoucher({ tripId, title: row.title, type: row.type, body: row.body || '' }),
      same: (e, row) => sameText(e.title, row.title)
    });
  }
  if (parts.phrases) {
    await applyList({
      mode, key: 'phrases', rows: plan.phrases || [], report,
      load: () => api.phrases(tripId),
      remove: (id) => api.deletePhrase(id),
      create: (row) => api.createPhrase({ tripId, situation: row.situation, ko: row.ko, localText: row.localText, locale: row.locale || 'en-US' }),
      same: (e, row) => sameText(e.localText, row.localText)
    });
  }
  if (parts.packing) {
    await applyList({
      mode, key: 'packing', rows: plan.packing || [], report,
      load: () => api.packing(tripId),
      remove: (id) => api.deletePacking(id),
      // 받은 사람의 짐은 아직 안 쌌으니 체크 표시는 가져오지 않는다
      create: (row) => api.createPacking({ tripId, name: row.name, category: row.category || 'OTHER', quantity: row.quantity ?? 1, note: row.note || '', packed: false, sortOrder: row.sortOrder ?? 0 }),
      same: (e, row) => sameText(e.name, row.name)
    });
  }

  await refreshGuideCache();
  return { tripId, report };
}

/** 적용 결과를 한 줄로 — "일정 5곳 추가 · 준비물 3개 건너뜀" */
export function reportText(report) {
  const names = { schedule: ['일정', '곳'], packing: ['준비물', '개'], vouchers: ['티켓', '개'], phrases: ['회화', '개'] };
  const parts = [];
  for (const key of Object.keys(names)) {
    const [label, unit] = names[key];
    if (report.added[key]) parts.push(`${label} ${report.added[key]}${unit} 추가`);
    if (report.removed[key]) parts.push(`${label} ${report.removed[key]}${unit} 교체`);
    if (report.skipped[key]) parts.push(`${label} ${report.skipped[key]}${unit} 건너뜀`);
  }
  if (report.skippedDays) parts.push(`${report.skippedDays}일 분량은 내 여행에 날이 없어 건너뜀`);
  return parts.join(' · ') || '바뀐 내용이 없어요';
}

async function importPortablePlanOffline(plan) {
  const tripId = -Math.abs(Date.now());
  const trip = {
    id: tripId,
    title: plan.trip.title,
    country: plan.trip.country || '',
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
