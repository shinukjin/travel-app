-- Honeymoon Guide — 공유 링크 (앱 전용 링크 honeymoon://share/<token>)
-- 실행 위치: Supabase 대시보드 → SQL Editor
--
-- 보내는 사람이 "링크로 공유"를 누르면 계획 스냅샷(payload)이 여기에 저장되고, 짧은 토큰이 만들어진다.
-- 받는 사람은 토큰을 아는 경우에만, 로그인한 상태에서 get_shared_plan() 으로 한 건을 읽는다.
-- 링크는 14일 뒤 만료되며, 보낸 사람은 언제든 삭제(철회)할 수 있다.

create table if not exists public.shared_plans (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 링크에 들어가는 비밀 토큰 (추측하기 어려운 20자리)
  token      text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  title      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  constraint shared_plans_payload_size check (octet_length(payload::text) <= 524288)
);

create index if not exists shared_plans_owner_idx on public.shared_plans (owner_id, created_at desc);

-- ───────────────────── 접근 규칙 (RLS) ─────────────────────
-- 보낸 사람(owner)만 자기 링크를 만들고, 보고, 삭제할 수 있다.
-- 받는 사람은 테이블을 직접 읽지 못하고 아래 함수로만 읽는다 (토큰을 알아야 하고 만료 전이어야 함).

alter table public.shared_plans enable row level security;

drop policy if exists "own shared plans" on public.shared_plans;
create policy "own shared plans" on public.shared_plans
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create or replace function public.get_shared_plan(p_token text)
returns table (title text, payload jsonb, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.title, s.payload, s.expires_at
  from public.shared_plans s
  where s.token = p_token
    and s.expires_at > now()
  limit 1;
$$;

revoke all on public.shared_plans from anon;
revoke all on function public.get_shared_plan(text) from public, anon;

grant select, insert, update, delete on public.shared_plans to authenticated;
grant usage, select on sequence public.shared_plans_id_seq to authenticated;
grant execute on function public.get_shared_plan(text) to authenticated;
