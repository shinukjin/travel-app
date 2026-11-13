import { Platform } from 'react-native';
import { getGoogleMapsApiKey } from '../mapsConfig';
import { withTimeout } from '../timeout';

/** 주변 탐색 분류 — Google Places 장소 유형(type)과 앱 분류(category) */
export const NEARBY_KINDS = [
  { id: 'sight', label: '관광지', type: 'tourist_attraction', category: 'SIGHT', icon: 'camera' },
  { id: 'food', label: '식당', type: 'restaurant', category: 'FOOD', icon: 'restaurant' },
  { id: 'cafe', label: '카페', type: 'cafe', category: 'FOOD', icon: 'cafe' },
  { id: 'stay', label: '숙소', type: 'lodging', category: 'STAY', icon: 'bed' },
  { id: 'shop', label: '쇼핑', type: 'shopping_mall', category: 'SIGHT', icon: 'bag-handle' }
];

function kindOf(id) {
  return NEARBY_KINDS.find((k) => k.id === id) || NEARBY_KINDS[0];
}

/** 두 좌표 사이 거리(m) */
function distanceM(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

function readLatLng(location) {
  if (!location) return { lat: null, lng: null };
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  return { lat, lng };
}

function placeFromResult(result, category = 'SIGHT') {
  const { lat, lng } = readLatLng(result.geometry?.location);
  if (lat == null || lng == null) return null;
  const types = result.types || [];
  const memo = types
    .filter((t) => !t.startsWith('point_of_interest') && t !== 'establishment')
    .slice(0, 3)
    .join(' · ');
  return {
    id: `gplace-${result.place_id}`,
    name: result.name || '이름 없음',
    category,
    lat,
    lng,
    address: result.vicinity || result.formatted_address || '',
    memo,
    placeId: result.place_id
  };
}

async function nearbyRest(lat, lng, radiusM, key, kind) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radiusM),
    type: kind.type,
    language: 'ko',
    key
  });
  let res;
  try {
    res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
  } catch {
    throw new Error('인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.');
  }
  if (!res.ok) throw new Error('주변 검색에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(placesStatusMessage(data.status, data.error_message));
  }
  return (data.results || []).map((r) => placeFromResult(r, kind.category)).filter(Boolean);
}

/**
 * Places API (New) — 새 프로젝트는 예전 Places API 를 쓸 수 없어서 이쪽을 먼저 쓴다.
 * Google Cloud 에서 "Places API (New)" 가 켜져 있고 키 제한에 포함되어 있어야 한다.
 */
async function nearbyNew(lat, lng, radiusM, key, kind) {
  let res;
  try {
    res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress,places.shortFormattedAddress,places.primaryTypeDisplayName'
      },
      body: JSON.stringify({
        includedTypes: [kind.type],
        rankPreference: 'DISTANCE',
        maxResultCount: 20,
        languageCode: 'ko',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } }
      })
    });
  } catch {
    throw new Error('인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message || '주변 검색에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
    // 권한·키 제한 문제면 예전 API 로 한 번 더 시도할 수 있게 표시한다
    error.denied = res.status === 401 || res.status === 403 || data.error?.status === 'PERMISSION_DENIED';
    throw error;
  }
  return (data.places || [])
    .map((p) => ({
      id: `gplace-${p.id}`,
      name: p.displayName?.text || '이름 없음',
      category: kind.category,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      address: p.shortFormattedAddress || p.formattedAddress || '',
      memo: p.primaryTypeDisplayName?.text || '',
      placeId: p.id
    }))
    .filter((p) => p.lat != null && p.lng != null);
}

/** Places 응답 상태를 사용자가 이해할 수 있는 문장으로 */
function placesStatusMessage(status, detail) {
  switch (status) {
    case 'REQUEST_DENIED':
      return 'Google Places 사용이 허용되지 않았어요. Google Cloud에서 "Places API (New)"를 켜고, API 키 제한에 포함되어 있는지 확인해 주세요.';
    case 'OVER_QUERY_LIMIT':
    case 'RESOURCE_EXHAUSTED':
      return '검색 사용량 한도를 넘었어요. 잠시 뒤 다시 시도해 주세요.';
    case 'INVALID_REQUEST':
      return '검색 조건이 올바르지 않아요. 위치를 다시 잡아 주세요.';
    default:
      return detail || `주변 검색에 실패했어요 (${status})`;
  }
}

async function nearbyWeb(lat, lng, radiusM, kind) {
  const { loadGoogleMapsApi } = await import('./googleMapsLoader.web');
  const key = getGoogleMapsApiKey();
  const maps = await loadGoogleMapsApi(key);
  const div = document.createElement('div');
  const service = new maps.places.PlacesService(div);
  return new Promise((resolve, reject) => {
    service.nearbySearch(
      {
        location: { lat, lng },
        radius: radiusM,
        type: kind.type
      },
      (results, status) => {
        if (status === maps.places.PlacesServiceStatus.OK) {
          resolve((results || []).map((r) => placeFromResult(r, kind.category)).filter(Boolean));
          return;
        }
        if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
          return;
        }
        reject(new Error(placesStatusMessage(status)));
      }
    );
  });
}

export async function fetchNearbyAttractions(lat, lng, radiusM = 1200, kindId = 'sight') {
  const kind = kindOf(kindId);
  const key = getGoogleMapsApiKey();
  if (!key) throw new Error('Google Maps API 키가 설정되지 않았어요. 앱을 빌드할 때 키가 들어갔는지 확인해 주세요.');
  // 지도 스크립트나 검색이 응답하지 않아도 화면이 멈추지 않게 제한 시간을 둔다
  const slow = '주변 검색 시간이 너무 오래 걸려요. 잠시 뒤 다시 시도해 주세요.';
  let list;
  try {
    list = await withTimeout(nearbyNew(lat, lng, radiusM, key, kind), 15000, slow);
  } catch (error) {
    // 새 API 가 허용되지 않은 키면 예전 API 로 한 번 더 시도한다 (둘 다 안 되면 안내 문구)
    if (!error.denied) throw error;
    const legacy = Platform.OS === 'web' ? nearbyWeb(lat, lng, radiusM, kind) : nearbyRest(lat, lng, radiusM, key, kind);
    list = await withTimeout(legacy, 15000, slow);
  }
  const seen = new Set();
  const unique = [];
  for (const place of list) {
    if (seen.has(place.placeId || place.name)) continue;
    seen.add(place.placeId || place.name);
    unique.push({ ...place, distanceM: Math.round(distanceM(lat, lng, place.lat, place.lng)) });
  }
  // 식당·카페는 가까운 곳이 먼저 나와야 쓸모가 있다
  unique.sort((a, b) => a.distanceM - b.distanceM);
  return unique.slice(0, 20);
}
