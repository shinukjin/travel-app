import { Platform } from 'react-native';
import { getGoogleMapsApiKey } from '../mapsConfig';

/**
 * 장소 이름·주소로 좌표를 찾는다. 못 찾거나 키가 없으면 null (오류를 던지지 않음).
 * 돌려주는 값: { lat, lng, address } | null
 */
export async function geocodeQuery(text) {
  const q = String(text || '').trim();
  const key = getGoogleMapsApiKey();
  if (!q || !key) return null;
  try {
    if (Platform.OS === 'web') {
      const { loadGoogleMapsApi } = await import('./googleMapsLoader.web');
      const maps = await loadGoogleMapsApi(key);
      const geocoder = new maps.Geocoder();
      const res = await new Promise((resolve) => geocoder.geocode({ address: q, language: 'ko' }, (r, status) => resolve(status === 'OK' ? r : null)));
      const hit = res?.[0];
      if (!hit) return null;
      const loc = hit.geometry.location;
      return { lat: loc.lat(), lng: loc.lng(), address: hit.formatted_address || '' };
    }
    const params = new URLSearchParams({ address: q, language: 'ko', key });
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (!r.ok) return null;
    const data = await r.json();
    const hit = data.status === 'OK' ? data.results?.[0] : null;
    if (!hit) return null;
    return { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, address: hit.formatted_address || '' };
  } catch {
    return null;
  }
}
