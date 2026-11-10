import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';

/**
 * 운영자 전용 API — DB 의 admin_* 함수를 호출한다.
 * 관리자가 아니면 DB 가 거부한다 ("forbidden"). 화면에서 숨기는 것은 편의일 뿐 보안은 DB가 맡는다.
 */
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
      throw new Error('DB 함수가 아직 없어요. Supabase SQL Editor 에서 supabase/migrations 의 SQL(0002~0005)을 순서대로 실행해 주세요.');
    }
    throw new Error(error.message === 'forbidden' ? '관리자 권한이 필요합니다.' : error.message);
  }
  return data;
}

export const adminApi = {
  /** 현재 로그인한 계정이 관리자인지. 실패 이유(error)도 함께 돌려줘 화면에서 진단할 수 있게 한다. */
  checkAdmin: async () => {
    const { data, error } = await supabase.rpc('is_admin');
    return { isAdmin: !error && data === true, error: error ? error.message : '' };
  },
  dashboard: () => rpc('admin_dashboard'),
  users: ({ search = '', status = 'all', limit = 20, offset = 0 } = {}) =>
    rpc('admin_list_users', { p_search: search, p_status: status, p_limit: limit, p_offset: offset }),
  getUser: (userId) => rpc('admin_get_user', { p_user_id: userId }),
  updateUser: (userId, { email, displayName = '', note = '', confirmed = true }) =>
    rpc('admin_update_user', { p_user_id: userId, p_email: email, p_display_name: displayName, p_note: note, p_confirmed: confirmed }),
  /** until: ISO 문자열 (없으면 무기한), reason: 정지 사유 */
  setBanned: (userId, banned, { until = null, reason = null } = {}) =>
    rpc('admin_set_banned', { p_user_id: userId, p_banned: banned, p_until: until, p_reason: reason }),
  setAdmin: (userId, admin) => rpc('admin_set_admin', { p_user_id: userId, p_admin: admin }),
  deleteUser: (userId) => rpc('admin_delete_user', { p_user_id: userId }),
  logs: ({ event = '', platform = '', search = '', limit = 30, offset = 0 } = {}) =>
    rpc('admin_list_logs', { p_event: event, p_platform: platform, p_search: search, p_limit: limit, p_offset: offset }),
  /** 비밀번호 재설정 메일 발송 */
  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw new Error(error.message);
  }
};

/* ───────────────── 인사이트 · 운영 기록 ───────────────── */

adminApi.insights = () => rpc('admin_insights');
adminApi.audit = ({ action = '', search = '', limit = 30, offset = 0 } = {}) =>
  rpc('admin_list_audit', { p_action: action, p_search: search, p_limit: limit, p_offset: offset });

/* ───────────────── 관광지 카탈로그 (관리자 등록) ───────────────── */

const blank = (v) => (v === undefined || v === null || v === '' ? null : v);

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
  memo: r.memo,
  isActive: r.is_active,
  updatedAt: r.updated_at
});

const fromCatalog = (b) => ({
  country: String(b.country || '').toUpperCase(),
  city: blank(b.city),
  name: String(b.name || '').trim(),
  name_local: blank(b.nameLocal),
  category: b.category,
  lat: Number(b.lat),
  lng: Number(b.lng),
  address: blank(b.address),
  memo: blank(b.memo),
  is_active: b.isActive !== false
});

async function catalogRun(query) {
  const { data, error, count } = await query;
  if (error) {
    if (error.code === '23505' || /duplicate key/i.test(error.message)) {
      throw new Error('같은 나라·도시에 같은 이름의 관광지가 이미 있습니다.');
    }
    if (error.code === '42501' || /row-level security/i.test(error.message)) throw new Error('관리자 권한이 필요합니다.');
    throw new Error(error.message);
  }
  return { data, count };
}

adminApi.catalog = {
  /** 나라별 개수 (비활성 포함) */
  countries: () => rpc('catalog_countries', { p_include_inactive: true }),

  /** 해당 나라에 이미 등록된 도시 이름들 (도시 선택 목록용) */
  cities: async (country) => {
    if (!country) return [];
    const { data } = await catalogRun(
      supabase.from('catalog_places').select('city').eq('country', country).not('city', 'is', null).limit(1000)
    );
    return [...new Set(data.map((r) => r.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  },

  list: async ({ country = '', category = '', q = '', status = 'all', limit = 30, offset = 0 } = {}) => {
    let query = supabase.from('catalog_places').select('*', { count: 'exact' });
    if (country) query = query.eq('country', country);
    if (category) query = query.eq('category', category);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);
    const term = String(q || '').replace(/[%*,()\\s]+/g, ' ').trim();
    if (term) query = query.or(`name.ilike.%${term}%,name_local.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
    const { data, count } = await catalogRun(
      query.order('country').order('city', { nullsFirst: false }).order('name').range(offset, offset + limit - 1)
    );
    return { total: count ?? data.length, rows: data.map(toCatalog) };
  },

  create: async (b) => toCatalog((await catalogRun(supabase.from('catalog_places').insert(fromCatalog(b)).select().single())).data),
  update: async (id, b) =>
    toCatalog((await catalogRun(supabase.from('catalog_places').update(fromCatalog(b)).eq('id', id).select().single())).data),
  setActive: async (id, active) => {
    await catalogRun(supabase.from('catalog_places').update({ is_active: active }).eq('id', id));
  },
  remove: async (id) => {
    await catalogRun(supabase.from('catalog_places').delete().eq('id', id));
  },
  removeMany: async (ids) => {
    for (let i = 0; i < ids.length; i += 200) {
      await catalogRun(supabase.from('catalog_places').delete().in('id', ids.slice(i, i + 200)));
    }
  },

  /** 현재 조건(나라·분류·검색·상태)에 맞는 항목을 모두 지운다. 지운 개수를 돌려준다. */
  removeFiltered: async (filters = {}) => {
    let removed = 0;
    for (let round = 0; round < 200; round++) {
      const { rows } = await adminApi.catalog.list({ ...filters, limit: 500, offset: 0 });
      if (!rows.length) break;
      await adminApi.catalog.removeMany(rows.map((r) => r.id));
      removed += rows.length;
    }
    return removed;
  },

  /** 내보내기용: 현재 조건의 전체를 페이지를 넘겨가며 모두 가져온다 (최대 5,000건) */
  listAll: async (filters = {}) => {
    const all = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const { rows, total } = await adminApi.catalog.list({ ...filters, limit: 500, offset });
      all.push(...rows);
      if (all.length >= total || !rows.length) break;
    }
    return all;
  },

  /**
   * 일괄 등록: 이미 있는 항목(나라·도시·이름 같음)은 건너뛰고 나머지만 100건씩 넣는다.
   * 돌려주는 값: { inserted, skipped }
   */
  importRows: async (rows, onProgress = () => {}) => {
    const countries = [...new Set(rows.map((r) => r.country))];
    const existing = new Set();
    for (const c of countries) {
      for (let offset = 0; ; offset += 1000) {
        const { data } = await catalogRun(
          supabase.from('catalog_places').select('country, city, name').eq('country', c).range(offset, offset + 999)
        );
        data.forEach((r) => existing.add(`${r.country}|${(r.city || '').toLowerCase()}|${r.name.toLowerCase()}`));
        if (data.length < 1000) break;
      }
    }
    const fresh = [];
    let skipped = 0;
    for (const r of rows) {
      const key = `${r.country}|${(r.city || '').toLowerCase()}|${r.name.toLowerCase()}`;
      if (existing.has(key)) skipped++;
      else {
        existing.add(key);
        fresh.push(r);
      }
    }
    let inserted = 0;
    const failed = [];
    let done = 0;
    for (let i = 0; i < fresh.length; i += 100) {
      const rows = fresh.slice(i, i + 100);
      try {
        await catalogRun(supabase.from('catalog_places').insert(rows.map(fromCatalog)));
        inserted += rows.length;
      } catch {
        // 묶음 중 한 건이라도 문제가 있으면 전체가 거부되므로, 한 건씩 다시 넣어 문제 줄만 골라낸다
        for (const row of rows) {
          try {
            await catalogRun(supabase.from('catalog_places').insert(fromCatalog(row)));
            inserted++;
          } catch (e) {
            failed.push({ name: row.name, country: row.country, reason: e.message });
          }
        }
      }
      done += rows.length;
      onProgress(done, fresh.length);
    }
    return { inserted, skipped, failed };
  }
};

/* ───────────────── 비밀번호 관리 · 계정 추가 ───────────────── */

/** 운영자가 사용자 비밀번호를 직접 지정/초기화. forceChange=true 면 다음 로그인 때 변경을 요구한다. */
adminApi.setPassword = (userId, password, forceChange = true) =>
  rpc('admin_set_password', { p_user_id: userId, p_password: password, p_force_change: forceChange });

adminApi.setForcePasswordChange = (userId, force) =>
  rpc('admin_set_force_password_change', { p_user_id: userId, p_force: force });

/** 내 계정: 비밀번호 변경이 필요한 상태인지 / 변경을 마쳤음을 알림 */
adminApi.passwordChangeRequired = async () => {
  const { data, error } = await supabase.rpc('my_password_reset_required');
  return !error && data === true;
};
adminApi.clearPasswordChangeRequired = () => rpc('clear_password_change_required');

/** 내 비밀번호 변경 (로그인한 본인 계정) */
adminApi.changeMyPassword = async (password) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/same.*password|different from the old/i.test(error.message)) throw new Error('이전과 다른 비밀번호를 입력해 주세요.');
    throw new Error(error.message);
  }
  await adminApi.clearPasswordChangeRequired();
};

/**
 * 계정 추가 — 운영자 로그인 상태를 건드리지 않도록 임시 클라이언트로 가입시킨 뒤,
 * 인증 완료·표시 이름·변경 요구·관리자 권한을 DB 함수로 적용한다.
 * (Supabase 의 "새 사용자 가입 허용"이 켜져 있어야 한다.)
 */
adminApi.createUser = async ({ email, password, displayName = '', note = '', confirmed = true, forceChange = true, makeAdmin = false }) => {
  const tmp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await tmp.auth.signUp({ email: email.trim(), password });
  if (error) {
    const msg = error.message || '';
    if (/already registered/i.test(msg)) throw new Error('이미 가입된 이메일입니다.');
    if (/signups? (not allowed|are disabled)|not allowed for this instance/i.test(msg)) {
      throw new Error('Supabase 에서 "새 사용자 가입 허용"이 꺼져 있어 계정을 만들 수 없습니다. 설정에서 켠 뒤 다시 시도해 주세요.');
    }
    if (/rate limit/i.test(msg)) throw new Error('잠시 후 다시 시도해 주세요. (이메일 발송 제한)');
    throw new Error(msg);
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('이미 가입된 이메일입니다.');
  }
  const userId = data.user?.id;
  if (!userId) throw new Error('계정을 만들지 못했습니다.');
  await tmp.auth.signOut({ scope: 'local' }).catch(() => {});

  await rpc('admin_update_user', {
    p_user_id: userId,
    p_email: email.trim(),
    p_display_name: displayName,
    p_note: note,
    p_confirmed: confirmed
  });
  await rpc('admin_set_force_password_change', { p_user_id: userId, p_force: forceChange });
  if (makeAdmin) await rpc('admin_set_admin', { p_user_id: userId, p_admin: true });
  await rpc('admin_audit_user_created', { p_user_id: userId, p_make_admin: makeAdmin });
  return { id: userId, email: email.trim() };
};
