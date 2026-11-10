-- 0006: 내 장소에 "현지 이름" 추가
-- 구글 지도 길찾기·검색을 현지어 이름(예: Basílica de la Sagrada Família)으로 하기 위함.
-- 추천 관광지(catalog_places.name_local)를 가져올 때 함께 복사하고, 이미 가져온 장소도 채워 넣는다.

alter table public.places add column if not exists name_local text check (char_length(name_local) <= 120);

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

  insert into public.places (name, name_local, category, lat, lng, address, memo, catalog_id)
  values (
    c.name,
    c.name_local,
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

-- 이미 가져온 장소에 현지 이름 채우기 (내 장소에 현지 이름이 비어 있는 것만)
update public.places p
   set name_local = c.name_local
  from public.catalog_places c
 where p.catalog_id = c.id
   and p.name_local is null
   and c.name_local is not null;
