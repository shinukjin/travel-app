export { COUNTRIES, countryFlag, countryLabel, countryLabels, countryLocale, formatCountries, parseCountries, searchCountries, SPEECH_LOCALES } from './countries';
export const CATEGORY = { FOOD: '맛집', SIGHT: '관광', STAY: '숙소', TRANSIT: '교통' };
export const VOUCHER = { FLIGHT: '항공', HOTEL: '호텔', TICKET: '티켓' };
export const PACKING = {
  DOCS: '서류',
  CLOTHES: '의류',
  GEAR: '전자기기',
  TOILETRY: '세면',
  MEDICINE: '약',
  OTHER: '기타'
};
export const PACKING_HINTS = [
  { name: '여권', category: 'DOCS' },
  { name: '항공 보딩패스', category: 'DOCS' },
  { name: '여행자보험', category: 'DOCS' },
  { name: '충전기', category: 'GEAR' },
  { name: '보조배터리', category: 'GEAR' },
  { name: '멀티 어댑터', category: 'GEAR' },
  { name: '편한 신발', category: 'CLOTHES' },
  { name: '상비약', category: 'MEDICINE' },
  { name: '선크림', category: 'TOILETRY' },
  { name: '선글라스', category: 'OTHER' }
];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function categoryLabel(code) {
  return CATEGORY[code] || code || '-';
}

export function voucherLabel(code) {
  return VOUCHER[code] || code || '-';
}

export function packingLabel(code) {
  return PACKING[code] || code || '-';
}

export function formatDay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEK[date.getDay()]})`;
}

export function formatRange(start, end) {
  if (!start || !end) return '-';
  return `${formatDay(start)} – ${formatDay(end)}`;
}

export function formatTime(value) {
  if (!value) return '시간 미정';
  return String(value).slice(0, 5);
}

export function daySpan(start, end) {
  if (!start || !end) return 0;
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  const days = Math.round((to - from) / 86400000) + 1;
  return days > 0 ? days : 0;
}
