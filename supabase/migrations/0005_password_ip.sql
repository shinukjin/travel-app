-- Honeymoon Guide — 비밀번호 관리 · 사용자 IP 정보
-- 0001~0004 적용 후 실행하세요. (Supabase 대시보드 → SQL Editor)
--
-- 추가되는 것
--   admin_set_password              : 운영자가 사용자 비밀번호를 직접 지정/초기화 (정책 검사 + 기존 로그인 종료 + 운영 기록)
--   admin_set_force_password_change : "다음 로그인 때 비밀번호 변경 필요" 표시 켜기/끄기
--   my_password_reset_required      : (사용자 본인) 비밀번호 변경이 필요한지
--   clear_password_change_required  : (사용자 본인) 비밀번호를 바꾼 뒤 표시 해제
--   admin_audit_user_created        : 운영자가 만든 계정을 운영 기록에 남김
--   admin_get_user / admin_list_users 갱신 : IP·기기·비밀번호 상태 포함
--
-- 보안 원칙
--   - 비밀번호는 bcrypt 해시로만 저장되며, 운영 기록·로그에 비밀번호 값은 절대 남기지 않는다.
--   - 운영자가 비밀번호를 바꾸면 해당 사용자의 기존 로그인은 모두 끊기고, 기본으로 "다음 로그인 때 변경 필요"가 켜진다.
--   - 정책: 8~72자, 영문자와 숫자를 각각 1개 이상, 이메일과 같지 않아야 한다.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.user_admin_notes add column if not exists password_changed_at timestamptz;
alter table public.user_admin_notes add column if not exists force_password_change boolean not null default false;

-- ───────────────────────── 비밀번호 정책 ─────────────────────────

create or replace function public._check_password(p_password text, p_email text)
returns void
language plpgsql
immutable
as $$
begin
  if lower(coalesce(p_password, '')) = lower(coalesce(p_email, '')) and p_password is not null then
    raise exception '비밀번호를 이메일과 같게 할 수 없습니다.';
  end if;
  if p_password is null or char_length(p_password) < 8 then
    raise exception '비밀번호는 8자 이상이어야 합니다.';
  end if;
  if octet_length(p_password) > 72 then
    raise exception '비밀번호는 72바이트(영문 기준 72자) 이하여야 합니다.';
  end if;
  if p_password !~ '[A-Za-z]' or p_password !~ '[0-9]' then
    raise exception '비밀번호는 영문자와 숫자를 각각 1개 이상 포함해야 합니다.';
  end if;
end;
$$;
revoke all on function public._check_password(text, text) from public, anon, authenticated;

-- ───────────────────────── 운영자: 비밀번호 지정/초기화 ─────────────────────────
-- p_force_change = true 이면 사용자는 다음 로그인 직후 새 비밀번호를 정해야 한다. (임시 비밀번호 발급용)

create or replace function public.admin_set_password(
  p_user_id      uuid,
  p_password     text,
  p_force_change boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_force boolean := coalesce(p_force_change, true);
begin
  perform public._require_admin();

  if p_user_id = auth.uid() then
    raise exception '자기 비밀번호는 "내 비밀번호 변경"에서 바꿔 주세요.';
  end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;
  perform public._check_password(p_password, v_email);

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = p_user_id;

  -- 기존 로그인(세션)은 모두 종료 — 새 비밀번호로 다시 로그인해야 한다
  delete from auth.sessions where user_id = p_user_id;

  insert into public.user_admin_notes (user_id, force_password_change, password_changed_at, updated_by)
  values (p_user_id, v_force, now(), auth.uid())
  on conflict (user_id) do update
    set force_password_change = excluded.force_password_change,
        password_changed_at   = now(),
        updated_at            = now(),
        updated_by            = auth.uid();

  -- 비밀번호 값은 기록하지 않는다
  perform public._audit('user.password_set', p_user_id, v_email, jsonb_build_object('forceChange', v_force));
end;
$$;

create or replace function public.admin_set_force_password_change(p_user_id uuid, p_force boolean)
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
  if v_email is null then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;

  insert into public.user_admin_notes (user_id, force_password_change, updated_by)
  values (p_user_id, coalesce(p_force, false), auth.uid())
  on conflict (user_id) do update
    set force_password_change = excluded.force_password_change,
        updated_at = now(),
        updated_by = auth.uid();

  perform public._audit('user.password_force', p_user_id, v_email, jsonb_build_object('forceChange', coalesce(p_force, false)));
end;
$$;

-- 운영자가 만든 계정 기록 (계정 자체는 앱/Supabase 가입 API 로 만들어진다)
create or replace function public.admin_audit_user_created(p_user_id uuid, p_make_admin boolean default false)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_created timestamptz;
begin
  perform public._require_admin();
  select email, created_at into v_email, v_created from auth.users where id = p_user_id;
  if v_email is null then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;
  -- 오래된 계정을 "방금 만든 것"으로 기록하지 못하게 한다
  if v_created < now() - interval '10 minutes' then
    raise exception '방금 만든 계정만 기록할 수 있습니다.';
  end if;
  perform public._audit('user.create', p_user_id, v_email, jsonb_build_object('admin', coalesce(p_make_admin, false)));
end;
$$;

-- ───────────────────────── 사용자 본인 ─────────────────────────

create or replace function public.my_password_reset_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select force_password_change from public.user_admin_notes where user_id = auth.uid()), false);
$$;

-- 사용자가 (auth.updateUser 로) 비밀번호를 바꾼 직후 호출 — "변경 필요" 표시를 끈다
create or replace function public.clear_password_change_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.user_admin_notes (user_id, force_password_change, password_changed_at)
  values (auth.uid(), false, now())
  on conflict (user_id) do update
    set force_password_change = false,
        password_changed_at   = now(),
        updated_at            = now();
end;
$$;

-- ───────────────────────── 사용자 상세 (IP·기기·비밀번호 상태 포함) ─────────────────────────

create or replace function public.admin_get_user(p_user_id uuid)
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
    'id',           u.id,
    'email',        u.email,
    'displayName',  n.display_name,
    'note',         n.note,
    'createdAt',    u.created_at,
    'lastSignInAt', u.last_sign_in_at,
    'confirmed',    (u.email_confirmed_at is not null),
    'confirmedAt',  u.email_confirmed_at,
    'banned',       (u.banned_until is not null and u.banned_until > now()),
    'bannedUntil',  case when u.banned_until is not null and u.banned_until > now() then u.banned_until end,
    'permanent',    (u.banned_until is not null and u.banned_until > now() + interval '50 years'),
    'banReason',    n.ban_reason,
    'isAdmin',      exists (select 1 from public.admins a where a.user_id = u.id),
    'tripCount',    (select count(*) from public.trips t where t.owner_id = u.id),
    'logCount',     (select count(*) from public.access_logs l where l.user_id = u.id),
    'provider',     u.raw_app_meta_data ->> 'provider',
    'passwordChangedAt',   n.password_changed_at,
    'forcePasswordChange', coalesce(n.force_password_change, false),
    -- IP · 기기
    'lastIp',   (select ip from public.access_logs where user_id = u.id and ip is not null order by created_at desc limit 1),
    'firstIp',  (select ip from public.access_logs where user_id = u.id and ip is not null order by created_at asc  limit 1),
    'lastDevice', (select device from public.access_logs where user_id = u.id order by created_at desc limit 1),
    'ips', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x."lastSeen" desc), '[]'::jsonb)
        from (
          select ip, count(*) as count, min(created_at) as "firstSeen", max(created_at) as "lastSeen"
            from public.access_logs
           where user_id = u.id and ip is not null
           group by ip
           order by max(created_at) desc
           limit 8
        ) x
    ),
    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'count', n) order by n desc), '[]'::jsonb)
        from (select platform, count(*) as n from public.access_logs where user_id = u.id group by platform) p
    ),
    'recentLogs', (
      select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
        from (
          select id, event, platform, device, ip, created_at as "createdAt"
            from public.access_logs
           where user_id = u.id
           order by created_at desc
           limit 10
        ) l
    )
  )
  into r
  from auth.users u
  left join public.user_admin_notes n on n.user_id = u.id
  where u.id = p_user_id;

  if r is null then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;
  return r;
end;
$$;

-- ───────────────────────── 사용자 목록 (최근 IP · 비밀번호 변경 필요 포함) ─────────────────────────

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
          or n.display_name ilike '%' || p_search || '%'
          or exists (select 1 from public.access_logs l where l.user_id = u.id and l.ip = p_search))
     and case p_status
           when 'banned'      then u.banned_until is not null and u.banned_until > now()
           when 'unconfirmed' then u.email_confirmed_at is null
           when 'admin'       then a.user_id is not null
           when 'active'      then (u.banned_until is null or u.banned_until <= now())
           when 'dormant'     then u.created_at < now() - interval '7 days'
                                   and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '30 days')
           when 'pwchange'    then coalesce(n.force_password_change, false)
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
             coalesce(n.force_password_change, false)                         as "forcePasswordChange",
             (select ip from public.access_logs l
               where l.user_id = u.id and l.ip is not null
               order by l.created_at desc limit 1)                            as "lastIp",
             (select count(*) from public.trips t where t.owner_id = u.id)    as "tripCount",
             (select count(*) from public.access_logs l where l.user_id = u.id) as "logCount"
        from auth.users u
        left join public.admins a on a.user_id = u.id
        left join public.user_admin_notes n on n.user_id = u.id
       where (coalesce(p_search, '') = ''
              or u.email ilike '%' || p_search || '%'
              or n.display_name ilike '%' || p_search || '%'
              or exists (select 1 from public.access_logs l where l.user_id = u.id and l.ip = p_search))
         and case p_status
               when 'banned'      then u.banned_until is not null and u.banned_until > now()
               when 'unconfirmed' then u.email_confirmed_at is null
               when 'admin'       then a.user_id is not null
               when 'active'      then (u.banned_until is null or u.banned_until <= now())
               when 'dormant'     then u.created_at < now() - interval '7 days'
                                       and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '30 days')
               when 'pwchange'    then coalesce(n.force_password_change, false)
               else true
             end
       order by u.created_at desc
       limit p_limit offset p_offset
    ) r;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public.admin_set_password(uuid, text, boolean)         from public, anon;
revoke all on function public.admin_set_force_password_change(uuid, boolean)  from public, anon;
revoke all on function public.admin_audit_user_created(uuid, boolean)         from public, anon;
revoke all on function public.my_password_reset_required()                    from public, anon;
revoke all on function public.clear_password_change_required()                from public, anon;
revoke all on function public.admin_get_user(uuid)                            from public, anon;
revoke all on function public.admin_list_users(text, text, int, int)          from public, anon;

grant execute on function public.admin_set_password(uuid, text, boolean)         to authenticated;
grant execute on function public.admin_set_force_password_change(uuid, boolean)  to authenticated;
grant execute on function public.admin_audit_user_created(uuid, boolean)         to authenticated;
grant execute on function public.my_password_reset_required()                    to authenticated;
grant execute on function public.clear_password_change_required()                to authenticated;
grant execute on function public.admin_get_user(uuid)                            to authenticated;
grant execute on function public.admin_list_users(text, text, int, int)          to authenticated;
