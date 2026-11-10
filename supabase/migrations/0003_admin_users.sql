-- Honeymoon Guide — 사용자 상세·편집 (운영자)
-- 0001_init.sql, 0002_admin.sql 적용 후 실행하세요. (Supabase 대시보드 → SQL Editor)
--
-- 추가되는 것
--   public.user_admin_notes : 운영자가 사용자에 붙이는 표시 이름·메모·정지 사유 (사용자 본인은 볼 수 없음)
--   admin_get_user          : 사용자 상세 (계정 정보 + 최근 접속 기록)
--   admin_update_user       : 이메일 · 표시 이름 · 메모 · 이메일 인증 상태 수정
--   admin_set_banned        : 정지를 기간·사유와 함께 지정하도록 확장 (기존 2개 인자 버전은 대체)
--   admin_list_users        : 표시 이름·정지 기한을 포함하도록 갱신

-- ───────────────────────── 운영자 메모 ─────────────────────────

create table if not exists public.user_admin_notes (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 60),
  note          text check (char_length(note) <= 2000),
  ban_reason    text check (char_length(ban_reason) <= 300),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null
);

alter table public.user_admin_notes enable row level security;
-- 정책 없음 + 권한 회수 → 클라이언트는 직접 접근 불가, admin_* 함수로만 다룬다.
revoke all on public.user_admin_notes from anon, authenticated;

-- ───────────────────────── 사용자 목록 (갱신) ─────────────────────────

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
               else true
             end
       order by u.created_at desc
       limit p_limit offset p_offset
    ) r;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- ───────────────────────── 사용자 상세 ─────────────────────────

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
    'recentLogs',   (
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

-- ───────────────────────── 사용자 정보 수정 ─────────────────────────
-- 이메일을 바꾸면 이후 새 이메일로 로그인한다. (비밀번호는 여기서 바꾸지 않는다 — 재설정 메일을 쓰세요.)

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
begin
  perform public._require_admin();

  if not exists (select 1 from auth.users where id = p_user_id) then
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

  -- 이메일 로그인 정보(identity)에도 새 이메일을 반영
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
end;
$$;

-- ───────────────────────── 정지 (기간·사유 지정) ─────────────────────────
-- p_until 이 null 이면 무기한. 정지하면 로그인 중인 기기도 모두 로그아웃된다.
-- (이전 2개 인자 버전과 함께 두면 호출이 모호해지므로 먼저 지운다.)

drop function if exists public.admin_set_banned(uuid, boolean);

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
begin
  perform public._require_admin();
  if p_user_id = auth.uid() then
    raise exception '자기 자신은 정지할 수 없습니다.';
  end if;

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
  else
    update auth.users set banned_until = null where id = p_user_id;
    update public.user_admin_notes
       set ban_reason = null, updated_at = now(), updated_by = auth.uid()
     where user_id = p_user_id;
  end if;
end;
$$;

-- ───────────────────────── 권한 ─────────────────────────

revoke all on function public.admin_list_users(text, text, int, int)                          from public, anon;
revoke all on function public.admin_get_user(uuid)                                            from public, anon;
revoke all on function public.admin_update_user(uuid, text, text, text, boolean)              from public, anon;
revoke all on function public.admin_set_banned(uuid, boolean, timestamptz, text)              from public, anon;

grant execute on function public.admin_list_users(text, text, int, int)                       to authenticated;
grant execute on function public.admin_get_user(uuid)                                         to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, text, boolean)           to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean, timestamptz, text)           to authenticated;
