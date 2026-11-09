const BASE = 'https://nominatim.openstreetmap.org';
const headers = { Accept: 'application/json', 'Accept-Language': 'ko,en' };

export async function searchPlaces(query) {
  const q = query.trim();
  if (!q) return [];
  const url = `${BASE}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('장소 검색에 실패했습니다.');
  return response.json();
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
