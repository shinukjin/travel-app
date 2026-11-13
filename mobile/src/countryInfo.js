import { parseCountries } from './countries';

/**
 * 국가별 여행 정보 — 통화 · 음성 언어 · 시간대 · 긴급전화.
 * 특정 나라에 치우치지 않도록 나라 코드(ISO 3166-1 alpha-2)로 찾고, 없으면 일반 값으로 대체한다.
 */

/** "값: 'AA BB CC'" 형태의 묶음 표를 { AA: 값, BB: 값 } 으로 펼친다 */
function expand(groups) {
  const map = {};
  for (const [value, codes] of Object.entries(groups)) {
    for (const code of codes.split(' ')) map[code] = value;
  }
  return map;
}

/* ---------- 통화 ---------- */

const CURRENCY_BY_COUNTRY = expand({
  KRW: 'KR',
  USD: 'US PR EC SV PA TL',
  EUR: 'AT BE CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES HR AD MC VA ME',
  JPY: 'JP', CNY: 'CN', TWD: 'TW', HKD: 'HK', MOP: 'MO', THB: 'TH', VND: 'VN', SGD: 'SG', MYR: 'MY',
  IDR: 'ID', PHP: 'PH', INR: 'IN', LKR: 'LK', NPR: 'NP', KHR: 'KH', LAK: 'LA', MMK: 'MM', MNT: 'MN',
  MVR: 'MV', BND: 'BN', BDT: 'BD', PKR: 'PK', AFN: 'AF', BTN: 'BT', KZT: 'KZ', KGS: 'KG', UZS: 'UZ',
  GBP: 'GB', CHF: 'CH LI', NOK: 'NO', SEK: 'SE', DKK: 'DK', ISK: 'IS', PLN: 'PL', CZK: 'CZ', HUF: 'HU',
  RON: 'RO', BGN: 'BG', RSD: 'RS', BAM: 'BA', MKD: 'MK', ALL: 'AL', MDL: 'MD', UAH: 'UA', BYN: 'BY',
  RUB: 'RU', TRY: 'TR', GEL: 'GE', AMD: 'AM', AZN: 'AZ',
  AED: 'AE', SAR: 'SA', QAR: 'QA', KWD: 'KW', BHD: 'BH', OMR: 'OM', JOD: 'JO', ILS: 'IL', LBP: 'LB',
  IQD: 'IQ', IRR: 'IR', YER: 'YE',
  EGP: 'EG', MAD: 'MA', TND: 'TN', DZD: 'DZ', LYD: 'LY', ZAR: 'ZA', KES: 'KE', TZS: 'TZ', UGX: 'UG',
  RWF: 'RW', ETB: 'ET', GHS: 'GH', NGN: 'NG', XOF: 'SN BJ', XAF: 'CM', AOA: 'AO', BWP: 'BW', MGA: 'MG',
  MUR: 'MU', SCR: 'SC', ZMW: 'ZM', ZWL: 'ZW', CVE: 'CV',
  CAD: 'CA', MXN: 'MX', BRL: 'BR', ARS: 'AR', CLP: 'CL', COP: 'CO', PEN: 'PE', UYU: 'UY', PYG: 'PY',
  BOB: 'BO', VES: 'VE', CRC: 'CR', CUP: 'CU', DOP: 'DO', GTQ: 'GT', HNL: 'HN', NIO: 'NI', JMD: 'JM', BZD: 'BZ',
  AUD: 'AU', NZD: 'NZ', FJD: 'FJ', VUV: 'VU'
});

/** 통화 한글 이름 — 없으면 코드를 그대로 보여 준다 */
export const CURRENCY_NAMES = {
  KRW: '원', USD: '미국 달러', EUR: '유로', JPY: '엔', CNY: '위안', TWD: '대만 달러', HKD: '홍콩 달러',
  MOP: '마카오 파타카', THB: '바트', VND: '동', SGD: '싱가포르 달러', MYR: '링깃', IDR: '루피아', PHP: '필리핀 페소',
  INR: '인도 루피', LKR: '스리랑카 루피', NPR: '네팔 루피', KHR: '리엘', LAK: '킵', MMK: '짯', MNT: '투그릭',
  MVR: '루피야', BND: '브루나이 달러', BDT: '타카', PKR: '파키스탄 루피', AFN: '아프가니', BTN: '눌트럼',
  KZT: '텡게', KGS: '솜', UZS: '숨', GBP: '파운드', CHF: '스위스 프랑', NOK: '노르웨이 크로네',
  SEK: '스웨덴 크로나', DKK: '덴마크 크로네', ISK: '아이슬란드 크로나', PLN: '즐로티', CZK: '코루나',
  HUF: '포린트', RON: '레우', BGN: '레프', RSD: '세르비아 디나르', BAM: '태환 마르크', MKD: '데나르', ALL: '렉',
  MDL: '몰도바 레우', UAH: '흐리브냐', BYN: '벨라루스 루블', RUB: '루블', TRY: '리라', GEL: '라리',
  AMD: '드람', AZN: '마나트', AED: '디르함', SAR: '사우디 리얄', QAR: '카타르 리얄', KWD: '쿠웨이트 디나르',
  BHD: '바레인 디나르', OMR: '오만 리얄', JOD: '요르단 디나르', ILS: '셰켈', LBP: '레바논 파운드',
  IQD: '이라크 디나르', IRR: '이란 리알', YER: '예멘 리알', EGP: '이집트 파운드', MAD: '모로코 디르함',
  TND: '튀니지 디나르', DZD: '알제리 디나르', LYD: '리비아 디나르', ZAR: '랜드', KES: '케냐 실링',
  TZS: '탄자니아 실링', UGX: '우간다 실링', RWF: '르완다 프랑', ETB: '비르', GHS: '세디', NGN: '나이라',
  XOF: '세파 프랑', XAF: '중앙아프리카 프랑', AOA: '콴자', BWP: '풀라', MGA: '아리아리', MUR: '모리셔스 루피',
  SCR: '세이셸 루피', ZMW: '콰차', ZWL: '짐바브웨 달러', CVE: '에스쿠도', CAD: '캐나다 달러', MXN: '멕시코 페소',
  BRL: '헤알', ARS: '아르헨티나 페소', CLP: '칠레 페소', COP: '콜롬비아 페소', PEN: '솔', UYU: '우루과이 페소',
  PYG: '과라니', BOB: '볼리비아노', VES: '볼리바르', CRC: '콜론', CUP: '쿠바 페소', DOP: '도미니카 페소',
  GTQ: '케찰', HNL: '렘피라', NIO: '코르도바', JMD: '자메이카 달러', BZD: '벨리즈 달러', AUD: '호주 달러',
  NZD: '뉴질랜드 달러', FJD: '피지 달러', VUV: '바투'
};

export function currencyName(code) {
  return CURRENCY_NAMES[code] || code;
}

/** 여행 국가들의 현지 통화 (중복 제거, 여행 국가 순서대로) */
export function currenciesForTrip(trip) {
  const list = parseCountries(trip?.country).map((cc) => CURRENCY_BY_COUNTRY[cc]).filter(Boolean);
  return [...new Set(list)];
}

/* ---------- 음성 언어 (회화 재생) ---------- */

const LOCALE_BY_COUNTRY = expand({
  'ar-SA': 'AE AF BH DZ EG IQ IR JO KW LB LY MA OM QA SA TN YE',
  'de-DE': 'AT CH DE LI',
  'el-GR': 'CY GR',
  'en-GB': 'AL AM AU AZ BA BD BG BN BT BW BY CZ DK EE ET FI FJ GB GE GH HR HU IE IL IN IS KE KG KH KZ LA LK LT LV MD ME MK MM MN MT MU MV MY NG NO NP NZ PK PL RO RS RU RW SC SE SG SI SK TZ UA UG UZ VU ZA ZM ZW',
  'en-US': 'BZ CA JM PH US',
  'es-ES': 'AD AR BO CL CO CR CU DO EC ES GT HN MX NI PA PE PR PY SV UY VE',
  'fr-FR': 'BE BJ CM FR LU MC MG SN',
  'id-ID': 'ID',
  'it-IT': 'IT VA',
  'ja-JP': 'JP',
  'ko-KR': 'KR',
  'nl-NL': 'NL',
  'pt-BR': 'BR',
  'pt-PT': 'AO CV PT TL',
  'th-TH': 'TH',
  'tr-TR': 'TR',
  'vi-VN': 'VN',
  'zh-CN': 'CN HK MO',
  'zh-TW': 'TW'
});

/** 회화 음성 언어 선택 목록 (코드 직접 입력 대신 고르는 용도) */
export const SPEECH_LOCALES = [
  { id: 'ko-KR', label: '한국어' },
  { id: 'en-US', label: '영어 (미국)' },
  { id: 'en-GB', label: '영어 (영국)' },
  { id: 'ja-JP', label: '일본어' },
  { id: 'zh-CN', label: '중국어' },
  { id: 'zh-TW', label: '중국어 (대만)' },
  { id: 'es-ES', label: '스페인어' },
  { id: 'pt-PT', label: '포르투갈어' },
  { id: 'pt-BR', label: '포르투갈어 (브라질)' },
  { id: 'fr-FR', label: '프랑스어' },
  { id: 'it-IT', label: '이탈리아어' },
  { id: 'de-DE', label: '독일어' },
  { id: 'nl-NL', label: '네덜란드어' },
  { id: 'el-GR', label: '그리스어' },
  { id: 'tr-TR', label: '튀르키예어' },
  { id: 'th-TH', label: '태국어' },
  { id: 'vi-VN', label: '베트남어' },
  { id: 'id-ID', label: '인도네시아어' },
  { id: 'ar-SA', label: '아랍어' }
];

export function localeLabel(id) {
  return SPEECH_LOCALES.find((l) => l.id === id)?.label || id;
}

/** 첫 번째 여행 국가의 음성 언어 코드 (표에 없는 나라는 영어) */
export function localeForTrip(trip) {
  const first = parseCountries(trip?.country)[0];
  return first ? LOCALE_BY_COUNTRY[first] || 'en-US' : '';
}

/* ---------- 시간대 ---------- */

/** 나라마다 대표(수도) 시간대 하나 — 시간대가 여러 개인 나라는 수도 기준 */
const TIMEZONE_BY_COUNTRY = expand({
  'Asia/Seoul': 'KR', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Taipei': 'TW', 'Asia/Hong_Kong': 'HK',
  'Asia/Macau': 'MO', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kolkata': 'IN',
  'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP', 'Asia/Phnom_Penh': 'KH', 'Asia/Vientiane': 'LA',
  'Asia/Yangon': 'MM', 'Asia/Ulaanbaatar': 'MN', 'Indian/Maldives': 'MV', 'Asia/Brunei': 'BN',
  'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK', 'Asia/Kabul': 'AF', 'Asia/Thimphu': 'BT', 'Asia/Almaty': 'KZ',
  'Asia/Bishkek': 'KG', 'Asia/Tashkent': 'UZ', 'Asia/Dili': 'TL',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Lisbon': 'PT', 'Atlantic/Reykjavik': 'IS',
  'Europe/Paris': 'FR ES IT DE AT CH NL BE LU MC LI AD VA MT SI HR RS BA ME MK AL PL CZ SK HU DK NO SE',
  'Europe/Athens': 'GR CY FI EE LV LT BG RO MD UA', 'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU BY',
  'Asia/Dubai': 'AE OM', 'Asia/Riyadh': 'SA KW QA BH IQ YE', 'Asia/Tehran': 'IR', 'Asia/Jerusalem': 'IL',
  'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Baku': 'AZ',
  'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA', 'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ',
  'Africa/Tripoli': 'LY', 'Africa/Johannesburg': 'ZA BW ZM ZW', 'Africa/Nairobi': 'KE TZ UG ET MG',
  'Africa/Kigali': 'RW', 'Africa/Accra': 'GH SN', 'Africa/Lagos': 'NG BJ CM AO', 'Indian/Mauritius': 'MU',
  'Indian/Mahe': 'SC', 'Atlantic/Cape_Verde': 'CV',
  'America/New_York': 'US', 'America/Toronto': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Bogota': 'CO EC',
  'America/Lima': 'PE', 'America/Panama': 'PA', 'America/Caracas': 'VE', 'America/Montevideo': 'UY',
  'America/Asuncion': 'PY', 'America/La_Paz': 'BO', 'America/Costa_Rica': 'CR', 'America/Havana': 'CU',
  'America/Santo_Domingo': 'DO', 'America/Guatemala': 'GT SV HN NI BZ', 'America/Jamaica': 'JM',
  'America/Puerto_Rico': 'PR',
  'Australia/Sydney': 'AU', 'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ', 'Pacific/Efate': 'VU'
});

/**
 * 여행지에서 보여 줄 시간대 목록 — 같은 시간대를 쓰는 여행 국가끼리 묶는다.
 * [{ tz: 'Europe/Paris', countries: ['ES', 'FR'] }]
 */
export function timezonesForTrip(trip) {
  const groups = new Map();
  for (const cc of parseCountries(trip?.country)) {
    const tz = TIMEZONE_BY_COUNTRY[cc];
    if (!tz) continue;
    if (!groups.has(tz)) groups.set(tz, []);
    groups.get(tz).push(cc);
  }
  return [...groups].map(([tz, countries]) => ({ tz, countries }));
}

/** 시간대의 현재 시각("14:05")과 한국과의 시차("한국보다 8시간 느려요") */
export function clockFor(timeZone, now = new Date()) {
  try {
    const time = new Intl.DateTimeFormat('ko-KR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const offsetMin = (tz) => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
      const get = (t) => Number(parts.find((p) => p.type === t).value);
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
      return Math.round((asUtc - now.getTime()) / 60000);
    };
    const diff = offsetMin(timeZone) - offsetMin('Asia/Seoul');
    const hours = Math.abs(diff) / 60;
    const hoursText = Number.isInteger(hours) ? hours : hours.toFixed(1);
    const label = diff === 0 ? '한국과 같은 시간이에요' : `한국보다 ${hoursText}시간 ${diff < 0 ? '느려요' : '빨라요'}`;
    // 칩에 쓰는 짧은 표기: "−8시간" / "+2시간" / "시차 없음"
    const short = diff === 0 ? '시차 없음' : `${diff < 0 ? '−' : '+'}${hoursText}시간`;
    return { time, label, short };
  } catch {
    return null;
  }
}

/* ---------- 긴급전화 ---------- */

const EMERGENCY_BY_COUNTRY = expand({
  '112': 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS NO CH LI MC AD',
  '911': 'US CA PR MX PH',
  '999': 'GB SG HK',
  '000': 'AU',
  '111': 'NZ',
  '110': 'CN TW',
  '191': 'TH',
  '113': 'VN'
});

/** 여행 국가의 대표 긴급전화 (알려진 나라만, 일본은 경찰·소방 번호가 달라 따로) */
export function emergencyNumberFor(trip) {
  const first = parseCountries(trip?.country)[0];
  if (!first) return '';
  if (first === 'JP') return '110 (경찰) / 119 (구급·소방)';
  return EMERGENCY_BY_COUNTRY[first] || '';
}
