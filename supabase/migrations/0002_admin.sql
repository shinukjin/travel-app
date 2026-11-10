-- Honeymoon Guide — 운영자(관리자) 기능
-- 0001_init.sql 적용 후 실행하세요. (Supabase 대시보드 → SQL Editor)
--
-- 구성
--   public.admins       : 관리자 계정 목록 (클라이언트에서 직접 접근 불가)
--   public.access_logs  : 가입·로그인·앱 실행 기록 (앱·Admin 이 로그인할 때마다 기록)
--   admin_* 함수        : 관리자만 호출 가능한 대시보드·사용자·로그 관리 함수 (SECURITY DEFINER)
--
-- 보안 원칙
--   - 관리자 여부는 DB 의 public.admins 로만 판정한다 (화면에서 숨기는 것은 편의일 뿐, 실제 차단은 DB).
--   - 관리자도 다른 사용자의 여행·메모 같은 "내용"은 볼 수 없다 (RLS 그대로). 계정 정보·집계·로그만 본다.
--   - service_role 키는 어디에도 쓰지 않는다.

-- ───────────────────────── 관리자 목록 ─────────────────────────

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- 정책을 만들지 않는다 → anon/authenticated 는 이 테이블을 직접 읽거나 쓸 수 없다.
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ───────────────────────── 접속 로그 ─────────────────────────

create table if not exists public.access_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event       text not null check (event in ('signup', 'login', 'app_open', 'logout')),
  platform    text not null default 'unknown' check (char_length(platform) <= 24),
  device      text check (char_length(device) <= 200),
  -- PostgREST 가 전달하는 요청 헤더에서 접속 IP 를 읽는다 (없으면 null)
  ip          text default nullif(
                split_part(coalesce((nullif(current_setting('request.headers', true), '')::json) ->> 'x-forwarded-for', ''), ',', 1),
                ''
              ),
  created_at  timestamptz not null default now()
);

create index if not exists access_logs_created_idx on public.access_logs (created_at desc);
create index if not exists access_logs_user_idx    on public.access_logs (user_id, created_at desc);

alter table public.access_logs enable row level security;

drop policy if exists "insert own log" on public.access_logs;
create policy "insert own log" on public.access_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));
-- select 정책 없음: 로그는 admin_list_logs / admin_dashboard 로만 읽는다.

revoke all on public.access_logs from anon, authenticated;
grant insert on public.access_logs to authenticated;
grant usage, select on sequence public.access_logs_id_seq to authenticated;

-- ───────────────────────── 공통 도우미 ─────────────────────────

create or replace function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public._require_admin() from public, anon, authenticated;

-- 한국 시간(KST) 기준 날짜
create or replace function public._kst_date(ts timestamptz)
returns date
language sql
immutable
as $$ select (ts at time zone 'Asia/Seoul')::date $$;

-- ───────────────────────── 대시보드 ─────────────────────────

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  today date := public._kst_date(now());
  result jsonb;
begin
  perform public._require_admin();

  select jsonb_build_object(
    'totalUsers',       (select count(*) from auth.users),
    'newToday',         (select count(*) from auth.users where public._kst_date(created_at) = today),
    'new7d',            (select count(*) from auth.users where public._kst_date(created_at) >= today - 6),
    'new30d',           (select count(*) from auth.users where public._kst_date(created_at) >= today - 29),
    'activeToday',      (select count(distinct user_id) from public.access_logs where public._kst_date(created_at) = today),
    'active7d',         (select count(distinct user_id) from public.access_logs where public._kst_date(created_at) >= today - 6),
    'active30d',        (select count(distinct user_id) from public.access_logs where public._kst_date(created_at) >= today - 29),
    'bannedUsers',      (select count(*) from auth.users where banned_until is not null and banned_until > now()),
    'unconfirmedUsers', (select count(*) from auth.users where email_confirmed_at is null),
    'admins',           (select count(*) from public.admins),
    'totalTrips',       (select count(*) from public.trips),
    'signupsDaily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
        from generate_series(today - 29, today, interval '1 day') gs(d0)
        cross join lateral (select d0::date as d) x
        left join (
          select public._kst_date(created_at) as day, count(*) as n from auth.users group by 1
        ) c on c.day = x.d
    ),
    'activeDaily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d, 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
        from generate_series(today - 29, today, interval '1 day') gs(d0)
        cross join lateral (select d0::date as d) x
        left join (
          select public._kst_date(created_at) as day, count(distinct user_id) as n from public.access_logs group by 1
        ) c on c.day = x.d
    ),
    'recentUsers', (
      select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
        from (select id, email, created_at as "createdAt" from auth.users order by created_at desc limit 5) u
    ),
    'recentLogs', (
      select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
        from (
          select a.id, u.email, a.event, a.platform, a.created_at as "createdAt"
            from public.access_logs a join auth.users u on u.id = a.user_id
           order by a.created_at desc limit 10
        ) l
    )
  ) into result;

  return result;
end;
$$;

-- ───────────────────────── 사용자 목록 ─────────────────────────
-- p_status: all | active | banned | unconfirmed | admin

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
   where (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%')
     and case p_status
           when 'banned'      then u.banned_until is not null and u.banned_until > now()
           when 'unconfirmed' then u.email_confirmed_at is null
           when 'admin'       then a.user_id is not null
           when 'active'      then (u.banned_until is null or u.banned_until <= now())
           else true
         end;

  select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt" desc), '[]'::jsonb) into v_rows
    from (
      select u.id,
             u.email,
             u.created_at        as "createdAt",
             u.last_sign_in_at   as "lastSignInAt",
             (u.email_confirmed_at is not null)                              as confirmed,
             (u.banned_until is not null and u.banned_until > now())         as banned,
             (a.user_id is not null)                                         as "isAdmin",
             (select count(*) from public.trips t where t.owner_id = u.id)   as "tripCount",
             (select count(*) from public.access_logs l where l.user_id = u.id) as "logCount"
        from auth.users u
        left join public.admins a on a.user_id = u.id
       where (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%')
         and case p_status
               when 'banned'      then u.banned_until is not null and u.banned_until > now()
               when 'unconfirmed' then u.email_confirmed_at is null
               when 'admin'       then a.user_id is not null
               when 'active'      then (u.banned_until is null or u.banned_until <= now())
               else true
             end
       order by u.created_at desc
       limit p_limit offset p_offset
    ) r;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- ───────────────────────── 사용자 관리 동작 ─────────────────────────

-- 정지 / 정지 해제 (정지하면 기존 로그인 세션도 모두 끊는다)
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public._require_admin();
  if p_user_id = auth.uid() then
    raise exception '자기 자신은 정지할 수 없습니다.';
  end if;
  if p_banned and exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception '관리자 계정은 먼저 관리자 권한을 해제해야 정지할 수 있습니다.';
  end if;

  update auth.users
     set banned_until = case when p_banned then now() + interval '100 years' else null end
   where id = p_user_id;

  if p_banned then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;

-- 관리자 권한 부여 / 해제
create or replace function public.admin_set_admin(p_user_id uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public._require_admin();

  if p_admin then
    insert into public.admins (user_id) values (p_user_id) on conflict do nothing;
  else
    if p_user_id = auth.uid() then
      raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
    end if;
    delete from public.admins where user_id = p_user_id;
  end if;
end;
$$;

-- 계정 삭제 (해당 사용자의 여행·메모 등 모든 데이터가 함께 삭제된다)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public._require_admin();
  if p_user_id = auth.uid() then
    raise exception '자기 자신은 삭제할 수 없습니다.';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception '관리자 계정은 먼저 관리자 권한을 해제해야 삭제할 수 있습니다.';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

-- ───────────────────────── 접속 로그 목록 ─────────────────────────
-- p_event / p_platform: 빈 문자열이면 전체

create or replace function public.admin_list_logs(
  p_event    text default '',
  p_platform text default '',
  p_search   text default '',
  p_limit    int  default 30,
  p_offset   int  default 0
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
    from public.access_logs a join auth.users u on u.id = a.user_id
   where (coalesce(p_event, '') = '' or a.event = p_event)
     and (coalesce(p_platform, '') = '' or a.platform = p_platform)
     and (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%');

  select coalesce(jsonb_agg(to_jsonb(r) order by r."createdAt" desc, r.id desc), '[]'::jsonb) into v_rows
    from (
      select a.id,
             a.user_id    as "userId",
             u.email,
             a.event,
             a.platform,
             a.device,
             a.ip,
             a.created_at as "createdAt"
        from public.access_logs a join auth.users u on u.id = a.user_id
       where (coalesce(p_event, '') = '' or a.event = p_event)
         and (coalesce(p_platform, '') = '' or a.platform = p_platform)
         and (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%')
       order by a.created_at desc, a.id desc
       limit p_limit offset p_offset
    ) r;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public.admin_dashboard()                                from public, anon;
revoke all on function public.admin_list_users(text, text, int, int)           from public, anon;
revoke all on function public.admin_set_banned(uuid, boolean)                  from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean)                   from public, anon;
revoke all on function public.admin_delete_user(uuid)                          from public, anon;
revoke all on function public.admin_list_logs(text, text, text, int, int)      from public, anon;

grant execute on function public.admin_dashboard()                             to authenticated;
grant execute on function public.admin_list_users(text, text, int, int)        to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean)               to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean)                to authenticated;
grant execute on function public.admin_delete_user(uuid)                       to authenticated;
grant execute on function public.admin_list_logs(text, text, text, int, int)   to authenticated;

-- ───────────────────────── 첫 관리자 지정 (직접 실행) ─────────────────────────
-- SQL Editor 에서 본인 이메일로 한 번 실행하세요. (SQL Editor 는 RLS 를 거치지 않는 관리자 권한입니다.)
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'me@example.com'
--   on conflict do nothing;
