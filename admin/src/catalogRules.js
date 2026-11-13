import { COUNTRIES, countryLabel } from './countries';
import { parseCsv } from './adminCsv';

export const CATEGORIES = [
  { id: 'SIGHT', label: '관광' },
  { id: 'FOOD', label: '맛집' },
  { id: 'STAY', label: '숙소' },
  { id: 'TRANSIT', label: '교통' }
];
const CATEGORY_BY_LABEL = Object.fromEntries(CATEGORIES.flatMap((c) => [[c.label, c.id], [c.id.toLowerCase(), c.id]]));
const COUNTRY_BY_NAME = Object.fromEntries(COUNTRIES.map((c) => [c.name, c.code]));

export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

/** "41.4036, 2.1744" (구글 지도에서 복사한 형식) → { lat, lng } 또는 null */
export function parseCoords(text) {
  const m = String(text || '')
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

/** 입력 한 줄을 검사해 { row, errors } 로 돌려준다. row 는 DB 에 넣을 수 있는 모양(camelCase). */
export function normalizeCatalogRow(input) {
  const errors = [];
  let country = String(input.country ?? '').trim();
  if (country && !/^[A-Za-z]{2}$/.test(country)) country = COUNTRY_BY_NAME[country] || country;
  country = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) errors.push('나라를 확인하세요 (예: JP, 일본)');
  else if (!COUNTRIES.some((c) => c.code === country)) errors.push(`알 수 없는 나라 코드: ${country}`);

  const name = String(input.name ?? '').trim();
  if (!name) errors.push('이름이 비어 있습니다');
  else if (name.length > 120) errors.push('이름은 120자 이하');

  const catRaw = String(input.category ?? '').trim();
  const category = CATEGORY_BY_LABEL[catRaw] || CATEGORY_BY_LABEL[catRaw.toLowerCase()] || (CATEGORIES.some((c) => c.id === catRaw.toUpperCase()) ? catRaw.toUpperCase() : '');
  if (!category) errors.push('분류는 관광/맛집/숙소/교통 중 하나');

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (input.lat === '' || input.lat === null || input.lat === undefined || !Number.isFinite(lat)) errors.push('위도가 숫자가 아닙니다');
  else if (lat < -90 || lat > 90) errors.push('위도는 -90 ~ 90');
  if (input.lng === '' || input.lng === null || input.lng === undefined || !Number.isFinite(lng)) errors.push('경도가 숫자가 아닙니다');
  else if (lng < -180 || lng > 180) errors.push('경도는 -180 ~ 180');
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat === 0 && lng === 0) errors.push('좌표 (0, 0)은 올바르지 않아요');

  const clip = (v, max, label) => {
    const s = String(v ?? '').trim();
    if (s.length > max) errors.push(`${label}은(는) ${max}자 이하`);
    return s || null;
  };

  return {
    errors,
    row: {
      country,
      city: clip(input.city, 80, '도시'),
      name,
      nameLocal: clip(input.nameLocal, 120, '현지 이름'),
      category,
      lat,
      lng,
      address: clip(input.address, 300, '주소'),
      memo: clip(input.memo, 2000, '설명'),
      isActive: input.isActive !== false
    }
  };
}

const HEADER_ALIASES = {
  country: ['country', '국가', '국가코드', '나라'],
  city: ['city', '도시', '지역'],
  name: ['name', '이름', '관광지', '관광지명', '장소'],
  nameLocal: ['name_local', 'namelocal', '현지명', '현지이름', '영문명', '원어명'],
  category: ['category', '분류', '종류', '카테고리'],
  lat: ['lat', 'latitude', '위도'],
  lng: ['lng', 'lon', 'long', 'longitude', '경도'],
  coords: ['coords', 'coordinates', 'coordinate', '좌표', '위경도'],
  address: ['address', '주소'],
  memo: ['memo', '설명', '메모', '비고']
};

/** CSV 텍스트를 읽어 [{ line, row, errors }] 로 돌려준다. 첫 줄은 머리글이어야 한다. */
export function parseCatalogCsv(text) {
  const table = parseCsv(text);
  if (table.length < 2) return { items: [], error: '머리글과 데이터가 있어야 합니다. (첫 줄이 머리글)' };

  const head = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
  const index = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = head.findIndex((h) => aliases.includes(h));
    if (i >= 0) index[key] = i;
  }
  // 좌표는 lat/lng 두 열이거나 "41.40, 2.17" 한 열(coords)이면 된다
  const hasCoords = (index.lat !== undefined && index.lng !== undefined) || index.coords !== undefined;
  const missing = ['country', 'name', 'category'].filter((k) => index[k] === undefined).map((k) => HEADER_ALIASES[k][0]);
  if (!hasCoords) missing.push('lat, lng (또는 coords)');
  if (missing.length) {
    return { items: [], error: `필수 열이 없습니다: ${missing.join(', ')}. 첫 줄 머리글을 확인하세요. (인식된 열: ${head.join(', ') || '없음'})` };
  }

  const items = table.slice(1).map((cells, i) => {
    const pick = (k) => (index[k] === undefined ? '' : (cells[index[k]] ?? '').trim());
    const fromCoords = index.coords !== undefined ? parseCoords(pick('coords')) : null;
    const { row, errors } = normalizeCatalogRow({
      country: pick('country'),
      city: pick('city'),
      name: pick('name'),
      nameLocal: pick('nameLocal'),
      category: pick('category'),
      lat: pick('lat') !== '' ? pick('lat') : fromCoords ? fromCoords.lat : '',
      lng: pick('lng') !== '' ? pick('lng') : fromCoords ? fromCoords.lng : '',
      address: pick('address'),
      memo: pick('memo')
    });
    return { line: i + 2, row, errors };
  });
  return { items, error: '' };
}

/** 같은 파일 안에서 (나라, 도시, 이름) 이 겹치는 줄 표시용 키 */
export const dupKey = (r) => `${r.country}|${(r.city || '').toLowerCase()}|${r.name.toLowerCase()}`;

export const CSV_TEMPLATE = [
  'country,city,name,name_local,category,lat,lng,address,memo',
  'ES,바르셀로나,사그라다 파밀리아,Basílica de la Sagrada Família,관광,41.4036,2.1744,"Carrer de Mallorca, 401","가우디의 대표작. 사전 예약 권장"',
  'ES,바르셀로나,구엘 공원,Park Güell,관광,41.4145,2.1527,Carrer d\'Olot,',
  'PT,리스본,벨렘탑,Torre de Belém,관광,38.6916,-9.2160,Av. Brasília,'
].join('\r\n');

export { countryLabel };
