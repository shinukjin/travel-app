/**
 * Supabase 데이터 계층 — web/src/supabaseApi.js 와 mobile/src/supabaseApi.js 는 동일한 파일입니다.
 * (수정 시 두 곳을 함께 고치세요.)
 *
 * 기존 Spring Boot API 와 같은 모양(camelCase, 중첩 일정)으로 돌려주므로 화면 코드는 그대로 쓴다.
 * 접근 제어는 DB 의 RLS(owner_id = auth.uid())가 맡는다.
 */

const DAY_MS = 86400000;

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

function dayDiff(start, end) {
  const [ay, am, ad] = String(start).split('-').map(Number);
  const [by, bm, bd] = String(end).split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/* ---------- 행 → 앱 모양 ---------- */

const toTrip = (r) => ({
  id: r.id,
  title: r.title,
  country: r.country,
  destination: r.destination,
  startDate: r.start_date,
  endDate: r.end_date,
  dayCount: dayDiff(r.start_date, r.end_date) + 1
});

const toPlace = (r) =>
  r
    ? {
        id: r.id,
        name: r.name,
        nameLocal: r.name_local ?? null,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        address: r.address,
        memo: r.memo,
        catalogId: r.catalog_id ?? null
      }
    : null;

const toCatalog = (r) => ({
  id: r.id,
  country: r.country,
  city: r.city,
  name: r.name,
  nameLocal: r.name_local,
  category: r.category,
  lat: r.lat,
  lng: r.lng,
  address: r.address,
  memo: r.memo
});

const toVoucher = (r) => ({ id: r.id, tripId: r.trip_id, title: r.title, type: r.type, body: r.body });

const toPhrase = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  situation: r.situation,
  ko: r.ko,
  localText: r.local_text,
  locale: r.locale
});

const toPacking = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  name: r.name,
  category: r.category,
  quantity: r.quantity,
  note: r.note,
  packed: r.packed,
  sortOrder: r.sort_order
});

const toMemo = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  content: r.content,
  photoUri: r.photo_uri,
  lat: r.lat,
  lng: r.lng,
  createdAt: r.created_at,
  clientId: r.client_id
});

const toMedia = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  localUri: r.local_uri,
  mediaType: r.media_type,
  capturedAt: r.captured_at,
  lat: r.lat,
  lng: r.lng
});

const toSchedule = (r) => ({
  id: r.id,
  tripId: r.trip_id,
  dayIndex: r.day_index,
  date: r.date,
  title: r.title,
  items: (r.schedule_items || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((i) => ({
      id: i.id,
      sortOrder: i.sort_order,
      startTime: i.start_time,
      note: i.note,
      place: toPlace(i.place)
    }))
});

const SCHEDULE_SELECT =
  'id, trip_id, day_index, date, title, schedule_items(id, sort_order, start_time, note, place:places(*))';

/* ---------- 입력 정리 (백엔드 검증과 동일) ---------- */

function normalizeCountries(raw) {
  const codes = [
    ...new Set(
      String(raw ?? '')
        .split(/[,/|;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c))
    )
  ];
  if (!codes.length) throw new Error('국가를 하나 이상 선택하세요.');
  return codes.join(',');
}

function tripRow(body) {
  if (!String(body.title ?? '').trim()) throw new Error('여행 이름을 입력하세요.');
  if (!body.startDate || !body.endDate) throw new Error('여행 기간을 입력하세요.');
  if (dayDiff(body.startDate, body.endDate) < 0) throw new Error('종료일은 시작일 이후여야 합니다.');
  return {
    title: String(body.title).trim(),
    country: normalizeCountries(body.country),
    destination: body.destination ? String(body.destination).trim() || null : null,
    start_date: body.startDate,
    end_date: body.endDate
  };
}

const blankToNull = (v) => (v === undefined || v === null || v === '' ? null : v);

/* ---------- 공개 API ---------- */

export function createDataApi(sb) {
  const byTrip = (query, tripId) => (tripId ? query.eq('trip_id', tripId) : query);

  const api = {
    trips: {
      list: async () => (await run(sb.from('trips').select('*').order('start_date'))).map(toTrip),
      get: async (id) => toTrip(await run(sb.from('trips').select('*').eq('id', id).single())),
      create: async (body) => toTrip(await run(sb.from('trips').insert(tripRow(body)).select().single())),
      update: async (id, body) => toTrip(await run(sb.from('trips').update(tripRow(body)).eq('id', id).select().single())),
      remove: async (id) => {
        await run(sb.from('trips').delete().eq('id', id));
      },
      schedules: async (tripId) =>
        (
          await run(
            sb
              .from('schedules')
              .select(SCHEDULE_SELECT)
              .eq('trip_id', tripId)
              .order('day_index')
          )
        ).map(toSchedule)
    },

    schedules: {
      /** 하루 일정 전체 교체 — items: [{ placeId, startTime, note }] (배열 순서가 정렬 순서) */
      saveItems: async (scheduleId, items) => {
        await run(
          sb.rpc('replace_schedule_items', {
            p_schedule_id: scheduleId,
            p_items: (items || []).map((i) => ({
              placeId: i.placeId,
              startTime: blankToNull(i.startTime),
              note: blankToNull(i.note)
            }))
          })
        );
        return toSchedule(await run(sb.from('schedules').select(SCHEDULE_SELECT).eq('id', scheduleId).single()));
      }
    },

    places: {
      list: async () => (await run(sb.from('places').select('*').order('name'))).map(toPlace),
      create: async (b) => toPlace(await run(sb.from('places').insert(placeRow(b)).select().single())),
      update: async (id, b) => toPlace(await run(sb.from('places').update(placeRow(b)).eq('id', id).select().single())),
      remove: async (id) => {
        await run(sb.from('places').delete().eq('id', id));
      }
    },

    vouchers: {
      list: async (tripId) => (await run(byTrip(sb.from('vouchers').select('*'), tripId).order('id'))).map(toVoucher),
      create: async (b) => toVoucher(await run(sb.from('vouchers').insert(voucherRow(b)).select().single())),
      update: async (id, b) => toVoucher(await run(sb.from('vouchers').update(voucherRow(b)).eq('id', id).select().single())),
      remove: async (id) => {
        await run(sb.from('vouchers').delete().eq('id', id));
      }
    },

    phrases: {
      list: async (tripId) => (await run(byTrip(sb.from('phrases').select('*'), tripId).order('id'))).map(toPhrase),
      create: async (b) => toPhrase(await run(sb.from('phrases').insert(phraseRow(b)).select().single())),
      update: async (id, b) => toPhrase(await run(sb.from('phrases').update(phraseRow(b)).eq('id', id).select().single())),
      remove: async (id) => {
        await run(sb.from('phrases').delete().eq('id', id));
      }
    },

    packing: {
      list: async (tripId) =>
        (
          await run(
            byTrip(sb.from('packing_items').select('*'), tripId)
              .order('category')
              .order('sort_order')
              .order('id')
          )
        ).map(toPacking),
      create: async (b) => toPacking(await run(sb.from('packing_items').insert(packingRow(b)).select().single())),
      update: async (id, b) =>
        toPacking(await run(sb.from('packing_items').update(packingRow(b)).eq('id', id).select().single())),
      remove: async (id) => {
        await run(sb.from('packing_items').delete().eq('id', id));
      }
    },

    memos: {
      list: async (tripId) =>
        (await run(byTrip(sb.from('memos').select('*'), tripId).order('created_at', { ascending: false }))).map(toMemo),
      /** client_id 기준 upsert — 같은 메모를 다시 보내도 중복되지 않는다 */
      save: async (b) =>
        toMemo(
          await run(
            sb
              .from('memos')
              .upsert(
                {
                  trip_id: b.tripId,
                  content: b.content,
                  photo_uri: blankToNull(b.photoUri),
                  lat: blankToNull(b.lat),
                  lng: blankToNull(b.lng),
                  created_at: b.createdAt || undefined,
                  client_id: b.clientId
                },
                { onConflict: 'client_id' }
              )
              .select()
              .single()
          )
        )
    },

    /** 관리자가 등록해 둔 관광지(좌표 포함). 검색해서 내 장소로 가져올 수 있다. */
    catalog: {
      /** 등록된 나라와 개수: [{ country: 'ES', count: 12 }] */
      countries: async () => (await run(sb.rpc('catalog_countries'))) || [],
      /** country: 'ES' 또는 ['ES','PT'], q: 이름·도시·주소 검색어 */
      search: async ({ country = '', city = '', q = '', category = '', limit = 30, offset = 0 } = {}) => {
        let query = sb.from('catalog_places').select('*').eq('is_active', true);
        const countries = (Array.isArray(country) ? country : String(country || '').split(','))
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean);
        if (countries.length === 1) query = query.eq('country', countries[0]);
        else if (countries.length > 1) query = query.in('country', countries);
        if (category) query = query.eq('category', category);
        if (city) query = query.eq('city', city);
        // PostgREST 필터 문법을 깨뜨리는 문자는 검색어에서 뺀다
        const term = String(q || '').replace(/[%*,()\\\s]+/g, ' ').trim();
        if (term) {
          query = query.or(`name.ilike.%${term}%,name_local.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
        }
        const rows = await run(query.order('name').range(offset, offset + limit - 1));
        return rows.map(toCatalog);
      },
      /** 한 나라에 등록된 도시 이름들 (가나다순) */
      cities: async (country) => {
        if (!country) return [];
        const rows = await run(
          sb.from('catalog_places').select('city').eq('is_active', true).eq('country', String(country).toUpperCase()).not('city', 'is', null).limit(1000)
        );
        return [...new Set(rows.map((r) => r.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
      },
      /** 카탈로그 관광지를 내 장소로 복사해 돌려준다 (이미 가져왔다면 기존 장소) */
      importPlace: async (catalogId) => toPlace(await run(sb.rpc('import_catalog_place', { p_catalog_id: catalogId })))
    },

    mediaLogs: {
      list: async (tripId) =>
        (await run(byTrip(sb.from('media_logs').select('*'), tripId).order('captured_at'))).map(toMedia),
      create: async (b) =>
        toMedia(
          await run(
            sb
              .from('media_logs')
              .insert({
                trip_id: b.tripId,
                local_uri: b.localUri,
                media_type: b.mediaType || 'PHOTO',
                captured_at: b.capturedAt,
                lat: blankToNull(b.lat),
                lng: blankToNull(b.lng)
              })
              .select()
              .single()
          )
        )
    }
  };

  return api;
}

function placeRow(b) {
  if (!String(b.name ?? '').trim()) throw new Error('장소 이름을 입력하세요.');
  return {
    name: String(b.name).trim(),
    category: b.category || 'SIGHT',
    lat: blankToNull(b.lat),
    lng: blankToNull(b.lng),
    address: blankToNull(b.address),
    memo: blankToNull(b.memo),
    // 0006 적용 전 DB 에서도 동작하도록, 값이 있을 때만 보낸다
    ...(String(b.nameLocal ?? '').trim() ? { name_local: String(b.nameLocal).trim() } : {})
  };
}

function voucherRow(b) {
  return { trip_id: b.tripId, title: b.title, type: b.type || 'TICKET', body: b.body };
}

function phraseRow(b) {
  return { trip_id: b.tripId, situation: b.situation, ko: b.ko, local_text: b.localText, locale: b.locale };
}

function packingRow(b) {
  return {
    trip_id: b.tripId,
    name: b.name,
    category: b.category,
    quantity: b.quantity ?? 1,
    note: blankToNull(b.note),
    packed: !!b.packed,
    sort_order: b.sortOrder ?? 0
  };
}
