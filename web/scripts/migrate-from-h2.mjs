#!/usr/bin/env node
/**
 * 기존 Spring Boot(H2) 데이터를 Supabase 로 옮긴다. (선택 사항 — 새로 시작하려면 필요 없음)
 *
 * 사전 조건
 *   1) 기존 백엔드가 실행 중 (mvn spring-boot:run, 기본 http://localhost:8080)
 *   2) Supabase 에 supabase/migrations/0001_init.sql 적용 + 본인 계정 생성 완료
 *
 * 실행 (PowerShell 예시 — 비밀번호는 파일에 저장하지 말고 현재 세션 환경 변수로만 지정)
 *   $env:SUPABASE_URL      = "https://xxxx.supabase.co"
 *   $env:SUPABASE_ANON_KEY = "eyJ..."            # anon 키 (service_role 키 사용 금지)
 *   $env:MIGRATE_EMAIL     = "me@example.com"
 *   $env:MIGRATE_PASSWORD  = "..."
 *   node web/scripts/migrate-from-h2.mjs
 *
 * 다시 실행하면 데이터가 중복되므로, 한 번만 실행하세요.
 */
import { createClient } from '@supabase/supabase-js';
import { createDataApi } from '../src/supabaseApi.js';

const OLD_API = process.env.OLD_API || 'http://localhost:8080/api';
const { SUPABASE_URL, SUPABASE_ANON_KEY, MIGRATE_EMAIL, MIGRATE_PASSWORD } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MIGRATE_EMAIL || !MIGRATE_PASSWORD) {
  console.error('환경 변수 SUPABASE_URL, SUPABASE_ANON_KEY, MIGRATE_EMAIL, MIGRATE_PASSWORD 가 필요합니다.');
  process.exit(1);
}

async function old(path) {
  const res = await fetch(`${OLD_API}${path}`);
  if (!res.ok) throw new Error(`기존 API 실패 ${path}: ${res.status}`);
  return res.json();
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: authError } = await sb.auth.signInWithPassword({ email: MIGRATE_EMAIL, password: MIGRATE_PASSWORD });
if (authError) {
  console.error('로그인 실패:', authError.message);
  process.exit(1);
}
const api = createDataApi(sb);

const counts = { trips: 0, places: 0, items: 0, vouchers: 0, phrases: 0, packing: 0, memos: 0, media: 0 };

// 1) 장소 (이름+주소가 같은 중복은 하나로 합친다)
const placeMap = new Map();
const placeBySig = new Map();
for (const p of await old('/places')) {
  const sig = `${p.name}|${p.address || ''}`;
  if (!placeBySig.has(sig)) {
    const created = await api.places.create(p);
    placeBySig.set(sig, created.id);
    counts.places++;
  }
  placeMap.set(p.id, placeBySig.get(sig));
}

// 2) 여행 → 일정 → 부속 데이터
for (const t of await old('/trips')) {
  const trip = await api.trips.create(t); // 일차는 DB 트리거가 자동 생성
  counts.trips++;

  const oldDays = await old(`/trips/${t.id}/schedules`);
  const newDays = await api.trips.schedules(trip.id);
  for (const od of oldDays) {
    const nd = newDays.find((d) => d.date === od.date);
    if (!nd || !od.items?.length) continue;
    await api.schedules.saveItems(
      nd.id,
      od.items.map((i) => ({ placeId: placeMap.get(i.place.id), startTime: i.startTime, note: i.note }))
    );
    counts.items += od.items.length;
  }

  for (const v of await old(`/vouchers?tripId=${t.id}`)) {
    await api.vouchers.create({ ...v, tripId: trip.id });
    counts.vouchers++;
  }
  for (const p of await old(`/phrases?tripId=${t.id}`)) {
    await api.phrases.create({ ...p, tripId: trip.id });
    counts.phrases++;
  }
  for (const p of await old(`/packing-items?tripId=${t.id}`)) {
    await api.packing.create({ ...p, tripId: trip.id });
    counts.packing++;
  }
  for (const m of await old(`/memos?tripId=${t.id}`)) {
    await api.memos.save({ ...m, tripId: trip.id });
    counts.memos++;
  }
  for (const m of await old(`/media-logs?tripId=${t.id}`)) {
    await api.mediaLogs.create({ ...m, tripId: trip.id });
    counts.media++;
  }
}

console.log('이전 완료:', counts);
await sb.auth.signOut();
