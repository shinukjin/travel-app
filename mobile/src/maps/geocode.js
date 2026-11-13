import { Platform } from 'react-native';
import { getGoogleMapsApiKey } from '../mapsConfig';
import { withTimeout } from '../timeout';

/**
 * 장소 후보 목록 — { id, name, lat, lng, address }
 * Places API (New) 텍스트 검색을 먼저 쓴다. Geocoding API 가 결제 설정 문제로 거부되는 프로젝트에서도 동작한다.
 */
async function searchTextNew(q, key, limit) {
  let res;
  try {
    res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.location,places.formattedAddress,places.displayName'
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'ko', maxResultCount: limit })
    });
  } catch {
    const error = new Error('인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.');
    error.network = true;
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message || `장소 검색에 실패했어요 (${res.status})`);
    error.denied = res.status === 401 || res.status === 403;
    throw error;
  }
  return (data.places || [])
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text || '',
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      address: p.formattedAddress || ''
    }))
    .filter((p) => p.lat != null && p.lng != null);
}

/** 예전 Geocoding API — Places (New) 가 안 될 때의 대체 경로 (후보는 1개) */
async function geocodeLegacy(q, key) {
  if (Platform.OS === 'web') {
    const { loadGoogleMapsApi } = await import('./googleMapsLoader.web');
    const maps = await loadGoogleMapsApi(key);
    const geocoder = new maps.Geocoder();
    const res = await new Promise((resolve) => geocoder.geocode({ address: q, language: 'ko' }, (r, status) => resolve(status === 'OK' ? r : null)));
    const hit = res?.[0];
    if (!hit) return [];
    const loc = hit.geometry.location;
    return [{ id: hit.place_id || `g-${loc.lat()}-${loc.lng()}`, name: q, lat: loc.lat(), lng: loc.lng(), address: hit.formatted_address || '' }];
  }
  const params = new URLSearchParams({ address: q, language: 'ko', key });
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  if (!r.ok) return [];
  const data = await r.json();
  const hit = data.status === 'OK' ? data.results?.[0] : null;
  if (!hit) return [];
  return [{ id: hit.place_id || `g-${hit.geometry.location.lat}-${hit.geometry.location.lng}`, name: q, lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, address: hit.formatted_address || '' }];
}

/**
 * 이름·주소로 장소 후보를 찾는다 (최대 limit 개). 결과가 없으면 빈 배열,
 * 키가 없거나 두 경로 모두 실패하면 이유를 담은 오류를 던진다 — 화면이 사용자에게 알려 줄 수 있게.
 */
export async function searchPlaces(text, limit = 5) {
  const q = String(text || '').trim();
  if (!q) return [];
  const key = getGoogleMapsApiKey();
  if (!key) throw new Error('Google Maps API 키가 설정되지 않았어요. 앱을 빌드할 때 키가 들어갔는지 확인해 주세요.');
  const slow = '장소 검색 시간이 너무 오래 걸려요. 잠시 뒤 다시 시도해 주세요.';
  try {
    return await withTimeout(searchTextNew(q, key, limit), 10000, slow);
  } catch (error) {
    if (error.network) throw error;
    try {
      return await withTimeout(geocodeLegacy(q, key), 10000, slow);
    } catch {
      throw error.denied
        ? new Error('Google Places 사용이 허용되지 않았어요. Google Cloud에서 "Places API (New)"를 켜고, API 키 제한을 확인해 주세요.')
        : error;
    }
  }
}

/**
 * 첫 번째 후보의 좌표 — 못 찾거나 오류면 null (오류를 던지지 않음).
 * 돌려주는 값: { lat, lng, address } | null
 */
export async function geocodeQuery(text) {
  try {
    const [hit] = await searchPlaces(text, 1);
    return hit ? { lat: hit.lat, lng: hit.lng, address: hit.address } : null;
  } catch {
    return null;
  }
}
