function toRad(value) {
  return (value * Math.PI) / 180;
}

export function haversineKm(from, to) {
  const earth = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function travelLeg(from, to) {
  if (from?.lat == null || from?.lng == null || to?.lat == null || to?.lng == null) return null;
  const km = haversineKm(from, to);
  if (!Number.isFinite(km) || km < 0.05) return null;
  const walk = km <= 3;
  const speed = walk ? 4.5 : 18;
  const minutes = Math.max(1, Math.round((km / speed) * 60));
  const dist = km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
  const mode = walk ? 'walking' : 'driving';
  return {
    walk,
    label: `${walk ? '도보' : '차'} ${minutes}분 · ${dist}`,
    url: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${mode}`
  };
}
