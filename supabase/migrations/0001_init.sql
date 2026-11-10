-- Honeymoon Guide — Supabase 초기 스키마
-- 실행 위치: Supabase 대시보드 → SQL Editor (또는 `supabase db push`)
-- 모든 행은 owner_id(= 로그인한 사용자)로 격리되며, RLS로 본인 데이터만 읽고 쓸 수 있다.

-- ───────────────────────── 테이블 ─────────────────────────

create table if not exists public.trips (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  country     text not null check (char_length(country) <= 128),
  destination text,
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  constraint trips_dates_ok check (end_date >= start_date)
);

create table if not exists public.schedules (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id    bigint not null references public.trips (id) on delete cascade,
  day_index  int not null,
  date       date not null,
  title      text,
  unique (trip_id, date)
);

create table if not exists public.places (
  id        bigint generated always as identity primary key,
  owner_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name      text not null,
  category  text not null check (char_length(category) <= 32),
  lat       double precision,
  lng       double precision,
  address   text,
  memo      text
);

create table if not exists public.schedule_items (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schedule_id bigint not null references public.schedules (id) on delete cascade,
  place_id    bigint not null references public.places (id) on delete cascade,
  sort_order  int not null default 0,
  start_time  time,
  note        text
);

create table if not exists public.vouchers (
  id        bigint generated always as identity primary key,
  owner_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id   bigint not null references public.trips (id) on delete cascade,
  title     text not null,
  type      text not null check (char_length(type) <= 32),
  body      text not null
);

create table if not exists public.phrases (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id     bigint not null references public.trips (id) on delete cascade,
  situation   text not null,
  ko          text not null,
  local_text  text not null,
  locale      text not null check (char_length(locale) <= 16)
);

create table if not exists public.packing_items (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id     bigint not null references public.trips (id) on delete cascade,
  name        text not null,
  category    text not null check (char_length(category) <= 32),
  quantity    int not null default 1,
  note        text,
  packed      boolean not null default false,
  sort_order  int not null default 0
);

-- 메모: 앱이 만든 client_id로 중복 없이 upsert (오프라인 → 온라인 동기화)
create table if not exists public.memos (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id     bigint not null references public.trips (id) on delete cascade,
  content     text not null,
  photo_uri   text,
  lat         double precision,
  lng         double precision,
  created_at  timestamp not null default (now() at time zone 'utc'),
  client_id   text not null unique
);

-- 사진은 원본을 서버에 올리지 않고 메타데이터(촬영 시각·위치)만 저장한다.
create table if not exists public.media_logs (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id      bigint not null references public.trips (id) on delete cascade,
  local_uri    text not null,
  media_type   text not null check (char_length(media_type) <= 16),
  captured_at  timestamp not null,
  lat          double precision,
  lng          double precision
);

create index if not exists schedules_trip_idx       on public.schedules (trip_id);
create index if not exists schedule_items_sched_idx on public.schedule_items (schedule_id);
create index if not exists vouchers_trip_idx        on public.vouchers (trip_id);
create index if not exists phrases_trip_idx         on public.phrases (trip_id);
create index if not exists packing_trip_idx         on public.packing_items (trip_id);
create index if not exists memos_trip_idx           on public.memos (trip_id);
create index if not exists media_logs_trip_idx      on public.media_logs (trip_id);
create index if not exists trips_owner_idx          on public.trips (owner_id);
create index if not exists places_owner_idx         on public.places (owner_id);

-- ───────────────────── 일정(일차) 자동 생성 ─────────────────────
-- 여행 기간이 바뀌면 일차를 다시 맞춘다: 범위 밖 날짜는 삭제, 새 날짜는 추가, 일차 번호 재부여.
-- (기존 Spring Boot TripService.regenerateSchedules 와 같은 동작)

create or replace function public.regenerate_schedules()
returns trigger
language plpgsql
as $$
declare
  d   date;
  idx int := 1;
begin
  delete from public.schedules
   where trip_id = new.id
     and (date < new.start_date or date > new.end_date);

  for d in
    select gs::date
      from generate_series(new.start_date::timestamp, new.end_date::timestamp, interval '1 day') gs
  loop
    insert into public.schedules (owner_id, trip_id, day_index, date, title)
    values (new.owner_id, new.id, idx, d, idx || '일차')
    on conflict (trip_id, date) do update
      set day_index = excluded.day_index,
          title     = coalesce(nullif(public.schedules.title, ''), excluded.title);
    idx := idx + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists trips_regenerate_schedules on public.trips;
create trigger trips_regenerate_schedules
  after insert or update of start_date, end_date on public.trips
  for each row execute function public.regenerate_schedules();

-- ───────────────────── 일정 항목 일괄 교체 ─────────────────────
-- 하루 일정을 한 번에(원자적으로) 교체한다. 배열 순서가 곧 정렬 순서.
-- p_items 예: [{"placeId": 12, "startTime": "09:30", "note": "예약"}]

create or replace function public.replace_schedule_items(p_schedule_id bigint, p_items jsonb)
returns void
language plpgsql
as $$
declare
  v_owner uuid;
  item    jsonb;
  idx     int := 0;
begin
  select owner_id into v_owner from public.schedules where id = p_schedule_id;
  if v_owner is null then
    raise exception 'Schedule not found: %', p_schedule_id;
  end if;

  delete from public.schedule_items where schedule_id = p_schedule_id;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.schedule_items (owner_id, schedule_id, place_id, sort_order, start_time, note)
    values (
      v_owner,
      p_schedule_id,
      (item ->> 'placeId')::bigint,
      idx,
      nullif(item ->> 'startTime', '')::time,
      nullif(item ->> 'note', '')
    );
    idx := idx + 1;
  end loop;
end;
$$;

-- ───────────────────── 접근 규칙 (RLS) ─────────────────────
-- 로그인한 사용자(authenticated)만, 자기 owner_id 행만 접근. 비로그인(anon)은 전부 차단.

do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'schedules', 'places', 'schedule_items',
    'vouchers', 'phrases', 'packing_items', 'memos', 'media_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- anon 역할에는 아무 권한도 주지 않는다 (명시적으로 회수).
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.replace_schedule_items(bigint, jsonb) to authenticated;
