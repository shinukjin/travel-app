import { getGoogleMapsApiKey } from './mapsKey';

const BASE = 'https://nominatim.openstreetmap.org';
const headers = { Accept: 'application/json', 'Accept-Language': 'ko,en' };

/**
 * Google Places (New) 텍스트 검색 — 가게·관광지 이름까지 잘 찾는다.
 * 결과는 OSM(Nominatim) 응답 모양으로 맞춰 화면 코드는 그대로 쓴다.
 * bias: { lat, lng } — 지도가 보고 있는 곳 근처를 우선해서 찾는다 (제한은 아님)
 */
async function searchGoogle(q, key, bias, country, limit) {
  // 한 번에 최대 20개라, 더 필요하면 다음 쪽(nextPageToken)을 이어서 받는다
  const out = [];
  let pageToken = '';
  for (let page = 0; page < 3 && out.length < limit; page += 1) {
    const body = { textQuery: q, languageCode: 'ko', pageSize: Math.min(20, limit - out.length) };
    if (/^[A-Z]{2}$/.test(country || '')) body.regionCode = country; // 그 나라 결과를 우선
    if (bias?.lat != null && bias?.lng != null) {
      body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 } };
    }
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,nextPageToken'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      if (out.length) break; // 뒤 쪽이 실패해도 앞에서 받은 결과는 보여 준다
      throw new Error(`Google 장소 검색 실패 (${res.status})`);
    }
    const data = await res.json();
    for (const p of data.places || []) {
      if (!p.location) continue;
      out.push({
        place_id: `g-${p.id}`,
        name: p.displayName?.text || '',
        display_name: p.formattedAddress || p.displayName?.text || '',
        lat: String(p.location.latitude),
        lon: String(p.location.longitude)
      });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out.slice(0, limit);
}

async function searchOsm(q, country) {
  const cc = /^[A-Z]{2}$/.test(country || '') ? `&countrycodes=${country.toLowerCase()}` : '';
  const url = `${BASE}/search?format=jsonv2&addressdetails=1&limit=8${cc}&q=${encodeURIComponent(q)}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('장소 검색에 실패했습니다.');
  return response.json();
}

/** 장소 검색 — Google 을 먼저 쓰고, 키가 없거나 막혀 있으면 OSM 으로 대신한다 */
export async function searchPlaces(query, bias, country, limit = 10) {
  const q = query.trim();
  if (!q) return [];
  const key = getGoogleMapsApiKey();
  if (key) {
    try {
      const hits = await searchGoogle(q, key, bias, country, limit);
      if (hits.length) return hits;
    } catch {
      /* 아래 OSM 검색으로 대신한다 */
    }
  }
  return searchOsm(q, country);
}

export async function reverseGeocode(lat, lng) {
  const url = `${BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  return response.json();
}

export function hitToPlace(hit) {
  const name = hit.name || hit.display_name?.split(',')[0] || '';
  return {
    name,
    address: hit.display_name || '',
    lat: Number(hit.lat),
    lng: Number(hit.lon)
  };
}
