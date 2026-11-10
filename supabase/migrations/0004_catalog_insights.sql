-- Honeymoon Guide — 관광지 카탈로그 · 운영 기록 · 인사이트
-- 0001~0003 적용 후 실행하세요. (Supabase 대시보드 → SQL Editor)
--
-- 추가되는 것
--   public.catalog_places   : 관리자가 나라별로 등록하는 관광지(좌표 포함). 모든 로그인 사용자가 검색할 수 있다.
--   places.catalog_id       : 카탈로그에서 가져온 장소 표시 (중복 가져오기 방지)
--   import_catalog_place    : 카탈로그 관광지를 "내 장소"로 복사 (일정에 넣을 수 있게)
--   catalog_countries       : 등록된 나라별 개수
--   admin_audit_logs        : 운영자가 한 작업 기록 (정지·삭제·권한·카탈로그 변경)
--   admin_list_audit        : 운영 기록 조회
--   admin_insights          : 기기·시간대·국가별 통계, 사용 단계 전환율 등
--   admin_* 함수 갱신        : 작업이 운영 기록에 남도록 하고, 사용자 목록에 '휴면' 필터 추가

-- ═════════════════════════ 관광지 카탈로그 ═════════════════════════

create table if not exists public.catalog_places (
  id          bigint generated always as identity primary key,
  country     text not null check (country ~ '^[A-Z]{2}$'),
  city        text check (char_length(city) <= 80),
  name        text not null check (char_length(name) between 1 and 120),
  name_local  text check (char_length(name_local) <= 120),
  category    text not null check (category in ('FOOD', 'SIGHT', 'STAY', 'TRANSIT')),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  address     text check (char_length(address) <= 300),
  memo        text check (char_length(memo) <= 2000),
  is_active   boolean not null default true,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 같은 나라·도시에 같은 이름(대소문자 무시)은 한 번만
create unique index if not exists catalog_places_uniq
  on public.catalog_places (country, lower(name), coalesce(lower(city), ''));
create index if not exists catalog_places_country_idx on public.catalog_places (country, city);
create index if not exists catalog_places_name_idx    on public.catalog_places (lower(name));

create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalog_places_touch on public.catalog_places;
create trigger catalog_places_touch
  before update on public.catalog_places
  for each row execute function public._touch_updated_at();

alter table public.catalog_places enable row level security;

drop policy if exists "catalog read" on public.catalog_places;
create policy "catalog read" on public.catalog_places
  for select to authenticated
  using (is_active or public.is_admin());

drop policy if exists "catalog admin insert" on public.catalog_places;
create policy "catalog admin insert" on public.catalog_places
  for insert to authenticated with check (public.is_admin());

drop policy if exists "catalog admin update" on public.catalog_places;
create policy "catalog admin update" on public.catalog_places
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "catalog admin delete" on public.catalog_places;
create policy "catalog admin delete" on public.catalog_places
  for delete to authenticated using (public.is_admin());

revoke all on public.catalog_places from anon, authenticated;
grant select, insert, update, delete on public.catalog_places to authenticated;
grant usage, select on sequence public.catalog_places_id_seq to authenticated;

-- 내 장소가 어느 카탈로그 항목에서 왔는지 (같은 항목을 두 번 가져오지 않도록)
alter table public.places add column if not exists catalog_id bigint references public.catalog_places (id) on delete set null;
create unique index if not exists places_owner_catalog_uniq
  on public.places (owner_id, catalog_id) where catalog_id is not null;

-- 카탈로그 관광지를 내 장소로 복사한다. 이미 가져왔다면 기존 장소를 돌려준다.
-- (SECURITY INVOKER: 내 계정의 RLS 그대로 적용 — 내 places 에만 쓴다)
create or replace function public.import_catalog_place(p_catalog_id bigint)
returns public.places
language plpgsql
as $$
declare
  c public.catalog_places;
  p public.places;
begin
  select * into p from public.places where owner_id = auth.uid() and catalog_id = p_catalog_id;
  if found then
    return p;
  end if;

  select * into c from public.catalog_places where id = p_catalog_id and is_active;
  if not found then
    raise exception '관광지를 찾을 수 없습니다.';
  end if;

  insert into public.places (name, category, lat, lng, address, memo, catalog_id)
  values (
    c.name,
    c.category,
    c.lat,
    c.lng,
    nullif(concat_ws(' · ', nullif(c.city, ''), nullif(c.address, '')), ''),
    c.memo,
    c.id
  )
  returning * into p;
  return p;
end;
$$;

-- 등록된 나라별 관광지 수 (사용자는 활성 항목만, 관리자는 p_include_inactive 로 비활성 포함)
create or replace function public.catalog_countries(p_include_inactive boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('country', country, 'count', n) order by n desc, country), '[]'::jsonb)
    from (
      select country, count(*) as n
        from public.catalog_places
       where is_active or (p_include_inactive and public.is_admin())
       group by country
    ) t;
$$;

revoke all on function public.import_catalog_place(bigint) from public, anon;
revoke all on function public.catalog_countries(boolean)   from public, anon;
grant execute on function public.import_catalog_place(bigint) to authenticated;
grant execute on function public.catalog_countries(boolean)   to authenticated;

-- ═════════════════════════ 운영 기록 (감사 로그) ═════════════════════════

create table if not exists public.admin_audit_logs (
  id              bigint generated always as identity primary key,
  admin_id        uuid references auth.users (id) on delete set null,
  admin_email     text,
  action          text not null,
  target_user_id  uuid,
  target_email    text,
  detail          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;

create or replace function public._audit(p_action text, p_target uuid, p_target_email text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.admin_audit_logs (admin_id, admin_email, action, target_user_id, target_email, detail)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_target, p_target_email, p_detail);
end;
$$;
revoke all on function public._audit(text, uuid, text, jsonb) from public, anon, authenticated;

-- 카탈로그 변경도 운영 기록에 남긴다
create or replace function public._audit_catalog()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    perform public._audit('catalog.create', null, null, jsonb_build_object('name', new.name, 'country', new.country, 'city', new.city));
    return new;
  elsif tg_op = 'UPDATE' then
    perform public._audit('catalog.update', null, null, jsonb_build_object('name', new.name, 'country', new.country, 'active', new.is_active));
    return new;
  else
    perform public._audit('catalog.delete', null, null, jsonb_build_object('name', old.name, 'country', old.country));
    return old;
  end if;
end;
$$;

drop trigger if exists catalog_places_audit on public.catalog_places;
create trigger catalog_places_audit
  after insert or update or delete on public.catalog_places
  for each row execute function public._audit_catalog();

create or replace function public.admin_list_audit(
  p_action text default '',
  p_search text default '',
  p_limit  int  default 30,
  p_offset int  default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_total int;
  v_rows  jsonb;
begin
  perform public._require_admin();
  p_limit := least(greatest(coalesce(p_limit, 30), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total
    from public.admin_audit_logs a
   where (coalesce(p_action, '') = '' or a.action like p_action || '%')
     and (coalesce(p_search, '') = ''
          or a.admin_email ilike '%' || p_search || '%'
          or a.target_email ilike '%' || p_search || '%');

  select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt" desc, r.id desc), '[]'::jsonb) into v_rows
    from (
      select a.id,
             a.admin_email   as "adminEmail",
             a.action,
             a.target_email  as "targetEmail",
             a.detail,
             a.created_at    as "createdAt"
        from public.admin_audit_logs a
       where (coalesce(p_action, '') = '' or a.action like p_action || '%')
         and (coalesce(p_search, '') = ''
              or a.admin_email ilike '%' || p_search || '%'
              or a.target_email ilike '%' || p_search || '%')
       order by a.created_at desc, a.id desc
       limit p_limit offset p_offset
    ) r;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- ═════════════════════════ 관리 동작 갱신 (운영 기록 남기기) ═════════════════════════

create or replace function public.admin_set_banned(
  p_user_id uuid,
  p_banned  boolean,
  p_until   timestamptz default null,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  perform public._require_admin();
  if p_user_id = auth.uid() then
    raise exception '자기 자신은 정지할 수 없습니다.';
  end if;
  select email into v_email from auth.users where id = p_user_id;

  if p_banned then
    if exists (select 1 from public.admins where user_id = p_user_id) then
      raise exception '관리자 계정은 먼저 관리자 권한을 해제해야 정지할 수 있습니다.';
    end if;
    if p_until is not null and p_until <= now() then
      raise exception '정지 해제 시각은 현재보다 이후여야 합니다.';
    end if;

    update auth.users
       set banned_until = coalesce(p_until, now() + interval '100 years')
     where id = p_user_id;
    delete from auth.sessions where user_id = p_user_id;

    insert into public.user_admin_notes (user_id, ban_reason, updated_by)
    values (p_user_id, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid())
    on conflict (user_id) do update
      set ban_reason = excluded.ban_reason, updated_at = now(), updated_by = auth.uid();

    perform public._audit('user.ban', p_user_id, v_email,
      jsonb_build_object('until', p_until, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  else
    update auth.users set banned_until = null where id = p_user_id;
    update public.user_admin_notes
       set ban_reason = null, updated_at = now(), updated_by = auth.uid()
     where user_id = p_user_id;
    perform public._audit('user.unban', p_user_id, v_email, null);
  end if;
end;
$$;

create or replace function public.admin_set_admin(p_user_id uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  perform public._require_admin();
  select email into v_email from auth.users where id = p_user_id;

  if p_admin then
    insert into public.admins (user_id) values (p_user_id) on conflict do nothing;
    perform public._audit('admin.grant', p_user_id, v_email, null);
  else
    if p_user_id = auth.uid() then
      raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
    end if;
    delete from public.admins where user_id = p_user_id;
    perform public._audit('admin.revoke', p_user_id, v_email, null);
  end if;
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  perform public._require_admin();
  if p_user_id = auth.uid() then
    raise exception '자기 자신은 삭제할 수 없습니다.';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception '관리자 계정은 먼저 관리자 권한을 해제해야 삭제할 수 있습니다.';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  delete from auth.users where id = p_user_id;
  perform public._audit('user.delete', p_user_id, v_email, null);
end;
$$;

create or replace function public.admin_update_user(
  p_user_id      uuid,
  p_email        text,
  p_display_name text,
  p_note         text,
  p_confirmed    boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_old   text;
begin
  perform public._require_admin();

  select email into v_old from auth.users where id = p_user_id;
  if not found then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception '이메일 형식이 올바르지 않습니다.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user_id) then
    raise exception '이미 사용 중인 이메일입니다.';
  end if;
  if p_user_id = auth.uid() and not coalesce(p_confirmed, true) then
    raise exception '자기 자신의 이메일 인증은 해제할 수 없습니다.';
  end if;

  update auth.users
     set email = v_email,
         email_confirmed_at = case
           when coalesce(p_confirmed, true) then coalesce(email_confirmed_at, now())
           else null
         end
   where id = p_user_id;

  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email))
   where user_id = p_user_id and provider = 'email';

  insert into public.user_admin_notes (user_id, display_name, note, updated_by)
  values (p_user_id, v_name, v_note, auth.uid())
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        note         = excluded.note,
        updated_at   = now(),
        updated_by   = auth.uid();

  perform public._audit('user.update', p_user_id, v_email,
    jsonb_build_object('emailChanged', lower(v_old) <> v_email, 'confirmed', coalesce(p_confirmed, true)));
end;
$$;

-- 사용자 목록: '휴면'(가입 7일 지난 뒤 30일 이상 접속 없음) 필터 추가
create or replace function public.admin_list_users(
  p_search text default '',
  p_status text default 'all',
  p_limit  int  default 20,
  p_offset int  default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_total int;
  v_rows  jsonb;
begin
  perform public._require_admin();
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total
    from auth.users u
    left join public.admins a on a.user_id = u.id
    left join public.user_admin_notes n on n.user_id = u.id
   where (coalesce(p_search, '') = ''
          or u.email ilike '%' || p_search || '%'
          or n.display_name ilike '%' || p_search || '%')
     and case p_status
           when 'banned'      then u.banned_until is not null and u.banned_until > now()
           when 'unconfirmed' then u.email_confirmed_at is null
           when 'admin'       then a.user_id is not null
           when 'active'      then (u.banned_until is null or u.banned_until <= now())
           when 'dormant'     then u.created_at < now() - interval '7 days'
                                   and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '30 days')
           else true
         end;

  select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt" desc), '[]'::jsonb) into v_rows
    from (
      select u.id,
             u.email,
             n.display_name                                                   as "displayName",
             u.created_at                                                     as "createdAt",
             u.last_sign_in_at                                                as "lastSignInAt",
             (u.email_confirmed_at is not null)                               as confirmed,
             (u.banned_until is not null and u.banned_until > now())          as banned,
             case when u.banned_until is not null and u.banned_until > now()
                  then u.banned_until end                                     as "bannedUntil",
             (a.user_id is not null)                                          as "isAdmin",
             (n.note is not null and n.note <> '')                            as "hasNote",
             (select count(*) from public.trips t where t.owner_id = u.id)    as "tripCount",
             (select count(*) from public.access_logs l where l.user_id = u.id) as "logCount"
        from auth.users u
        left join public.admins a on a.user_id = u.id
        left join public.user_admin_notes n on n.user_id = u.id
       where (coalesce(p_search, '') = ''
              or u.email ilike '%' || p_search || '%'
              or n.display_name ilike '%' || p_search || '%')
         and case p_status
               when 'banned'      then u.banned_until is not null and u.banned_until > now()
               when 'unconfirmed' then u.email_confirmed_at is null
               when 'admin'       then a.user_id is not null
               when 'active'      then (u.banned_until is null or u.banned_until <= now())
               when 'dormant'     then u.created_at < now() - interval '7 days'
                                       and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '30 days')
               else true
             end
       order by u.created_at desc
       limit p_limit offset p_offset
    ) r;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- ═════════════════════════ 인사이트 (집계) ═════════════════════════
-- 개별 사용자의 내용은 노출하지 않고, 합계·분포만 돌려준다. 시간은 한국 시간(KST) 기준.

create or replace function public.admin_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  r jsonb;
begin
  perform public._require_admin();

  select jsonb_build_object(
    -- 최근 30일 접속 이벤트 분포
    'hourly', (
      select jsonb_agg(coalesce(c.n, 0) order by h)
        from generate_series(0, 23) h
        left join (
          select extract(hour from created_at at time zone 'Asia/Seoul')::int as hr, count(*) as n
            from public.access_logs where created_at >= now() - interval '30 days' group by 1
        ) c on c.hr = h
    ),
    -- 0=일 … 6=토
    'weekday', (
      select jsonb_agg(coalesce(c.n, 0) order by d)
        from generate_series(0, 6) d
        left join (
          select extract(dow from created_at at time zone 'Asia/Seoul')::int as dw, count(*) as n
            from public.access_logs where created_at >= now() - interval '30 days' group by 1
        ) c on c.dw = d
    ),
    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'count', n) order by n desc), '[]'::jsonb)
        from (select platform, count(*) as n from public.access_logs
               where created_at >= now() - interval '30 days' group by 1) p
    ),
    -- 여행 국가 / 목적지 Top 10
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('country', cc, 'count', n) order by n desc), '[]'::jsonb)
        from (
          select cc, count(*) as n
            from (select unnest(string_to_array(country, ',')) as cc from public.trips) t
           group by cc order by n desc limit 10
        ) x
    ),
    'destinations', (
      select coalesce(jsonb_agg(jsonb_build_object('destination', d, 'count', n) order by n desc), '[]'::jsonb)
        from (
          select btrim(destination) as d, count(*) as n
            from public.trips
           where destination is not null and btrim(destination) <> ''
           group by 1 order by n desc limit 10
        ) x
    ),
    -- 사용 단계별 사용자 수 (가입 → 여행 → 일정 → …)
    'funnel', jsonb_build_object(
      'signedUp',      (select count(*) from auth.users),
      'confirmed',     (select count(*) from auth.users where email_confirmed_at is not null),
      'createdTrip',   (select count(distinct owner_id) from public.trips),
      'addedSchedule', (select count(distinct owner_id) from public.schedule_items),
      'usedPacking',   (select count(distinct owner_id) from public.packing_items),
      'wroteMemo',     (select count(distinct owner_id) from public.memos)
    ),
    'content', jsonb_build_object(
      'trips',         (select count(*) from public.trips),
      'places',        (select count(*) from public.places),
      'scheduleItems', (select count(*) from public.schedule_items),
      'vouchers',      (select count(*) from public.vouchers),
      'phrases',       (select count(*) from public.phrases),
      'packingItems',  (select count(*) from public.packing_items),
      'memos',         (select count(*) from public.memos),
      'mediaLogs',     (select count(*) from public.media_logs)
    ),
    'dormantUsers', (
      select count(*) from auth.users
       where created_at < now() - interval '7 days'
         and (last_sign_in_at is null or last_sign_in_at < now() - interval '30 days')
    ),
    'returningUsers7d', (
      select count(distinct a.user_id)
        from public.access_logs a join auth.users u on u.id = a.user_id
       where a.created_at >= now() - interval '7 days' and u.created_at < now() - interval '7 days'
    ),
    'avgTripsPerUser', (
      select round(coalesce((select count(*)::numeric from public.trips) / nullif((select count(*) from auth.users), 0), 0), 2)
    ),
    'catalog', jsonb_build_object(
      'total',     (select count(*) from public.catalog_places),
      'active',    (select count(*) from public.catalog_places where is_active),
      'countries', (select count(distinct country) from public.catalog_places where is_active),
      'imports',   (select count(*) from public.places where catalog_id is not null)
    )
  ) into r;

  return r;
end;
$$;

-- ═════════════════════════ 권한 ═════════════════════════

revoke all on function public.admin_list_audit(text, text, int, int)                from public, anon;
revoke all on function public.admin_insights()                                      from public, anon;
revoke all on function public.admin_set_banned(uuid, boolean, timestamptz, text)    from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean)                        from public, anon;
revoke all on function public.admin_delete_user(uuid)                               from public, anon;
revoke all on function public.admin_update_user(uuid, text, text, text, boolean)    from public, anon;
revoke all on function public.admin_list_users(text, text, int, int)                from public, anon;

grant execute on function public.admin_list_audit(text, text, int, int)             to authenticated;
grant execute on function public.admin_insights()                                   to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean, timestamptz, text) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean)                     to authenticated;
grant execute on function public.admin_delete_user(uuid)                            to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_list_users(text, text, int, int)             to authenticated;
