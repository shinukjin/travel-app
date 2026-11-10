import { Platform } from 'react-native';
import { getGoogleMapsApiKey } from '../mapsConfig';

function readLatLng(location) {
  if (!location) return { lat: null, lng: null };
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  return { lat, lng };
}

function placeFromResult(result) {
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
    category: 'SIGHT',
    lat,
    lng,
    address: result.vicinity || result.formatted_address || '',
    memo,
    placeId: result.place_id
  };
}

async function nearbyRest(lat, lng, radiusM, key) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radiusM),
    type: 'tourist_attraction',
    language: 'ko',
    key
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
  if (!res.ok) throw new Error('주변 검색에 실패했습니다.');
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places 오류 (${data.status})`);
  }
  return (data.results || []).map(placeFromResult).filter(Boolean);
}

async function nearbyWeb(lat, lng, radiusM) {
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
        type: 'tourist_attraction'
      },
      (results, status) => {
        if (status === maps.places.PlacesServiceStatus.OK) {
          resolve((results || []).map(placeFromResult).filter(Boolean));
          return;
        }
        if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
          return;
        }
        reject(new Error(`Places 오류 (${status})`));
      }
    );
  });
}

export async function fetchNearbyAttractions(lat, lng, radiusM = 1200) {
  const key = getGoogleMapsApiKey();
  if (!key) throw new Error('Google Maps API 키가 필요합니다.');
  const list = Platform.OS === 'web' ? await nearbyWeb(lat, lng, radiusM) : await nearbyRest(lat, lng, radiusM, key);
  const seen = new Set();
  const unique = [];
  for (const place of list) {
    if (seen.has(place.placeId || place.name)) continue;
    seen.add(place.placeId || place.name);
    unique.push(place);
  }
  unique.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return unique.slice(0, 20);
}
