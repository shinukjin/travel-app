import { storage } from './storage';

/**
 * 환율 — "미화 1달러당 각 통화의 값" 표(table) 하나로 모든 통화 사이를 환산한다.
 * 예) table.KRW = 1334 (1달러 = 1334원), table.JPY = 159.8 → 1엔 ≈ 8.35원
 * manual: 사용자가 직접 입력한 통화 { JPY: 9.2 } (1 JPY = 9.2원). 자동 갱신이 덮어쓰지 않는다.
 */
const DEFAULT_RATES = {
  table: { USD: 1, KRW: 1340, EUR: 0.92 },
  updatedAt: null,
  manual: null
};

export async function loadFxRates() {
  const saved = await storage.getFxRates();
  // 예전 형식(EUR_KRW 등)으로 저장된 값은 쓰지 않고 새로 받는다
  if (!saved?.table?.KRW) return DEFAULT_RATES;
  return { ...DEFAULT_RATES, ...saved };
}

/** 환율 API — 통화 수가 많은 쪽을 먼저(약 160개), 실패하면 유럽중앙은행 기준(약 30개) */
const FX_SOURCES = [
  { url: 'https://open.er-api.com/v6/latest/USD', read: (json) => ({ rates: json.rates, date: json.time_last_update_utc && new Date(json.time_last_update_utc).toISOString().slice(0, 10) }) },
  { url: 'https://api.frankfurter.dev/v1/latest?base=USD', read: (json) => ({ rates: json.rates, date: json.date }) }
];

async function fetchTable() {
  let lastError = new Error('환율 조회 실패');
  for (const source of FX_SOURCES) {
    try {
      const res = await fetch(source.url);
      if (!res.ok) continue;
      const { rates, date } = source.read(await res.json());
      if (rates?.KRW) return { table: { ...rates, USD: 1 }, date };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const today = () => new Date().toISOString().slice(0, 10);

/** 최신 환율을 받아 저장한다 (직접 입력한 값은 해제) */
export async function refreshFxRates() {
  const { table, date } = await fetchTable();
  const payload = { table, updatedAt: date || today(), manual: null };
  await storage.setFxRates(payload);
  return payload;
}

/** 1 단위가 몇 원인지 (KRW 는 1) */
export function krwPer(cur, rates) {
  const t = rates.table;
  if (cur === 'KRW') return 1;
  if (!t[cur] || !t.KRW) return null;
  return t.KRW / t[cur];
}

/** 이 통화의 환율 정보가 있는지 */
export function hasRate(cur, rates) {
  return cur === 'USD' || Boolean(rates.table[cur]);
}

/**
 * 직접 입력한 환율 저장 — entries: { JPY: '9.2', USD: '1340' } (1 단위 = 몇 원)
 * 저장 후에는 자동 갱신이 덮어쓰지 않는다.
 */
export async function saveManualRates(entries, current) {
  const table = { ...current.table };
  const manual = { ...(current.manual || {}) };
  const parsed = Object.entries(entries).map(([cur, value]) => [cur, Number(value)]);
  if (parsed.some(([, n]) => !Number.isFinite(n) || n <= 0)) {
    throw new Error('환율은 0보다 큰 숫자여야 합니다');
  }
  // 달러를 먼저 반영해야 다른 통화가 바뀐 원화 기준을 쓴다
  parsed.sort(([a]) => (a === 'USD' ? -1 : 1));
  for (const [cur, krw] of parsed) {
    if (cur === 'USD') table.KRW = krw;
    else table[cur] = table.KRW / krw;
    manual[cur] = krw;
  }
  const payload = { table, updatedAt: today(), manual };
  await storage.setFxRates(payload);
  return payload;
}

export function convertAmount(amount, from, to, rates) {
  const n = Number(amount);
  const t = rates.table;
  if (!Number.isFinite(n) || n < 0 || !t[from] || !t[to]) return 0;
  return (n / t[from]) * t[to];
}

/** 입력 중인 숫자 문자열에 천 단위 쉼표를 넣는다 (소수점 이하 최대 2자리) */
export function formatNumberInput(text) {
  const cleaned = String(text ?? '').replace(/[^0-9.]/g, '');
  const [intRaw, ...rest] = cleaned.split('.');
  const intPart = intRaw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!rest.length) return intPart;
  return `${intPart || '0'}.${rest.join('').slice(0, 2)}`;
}

/** 쉼표가 섞인 입력 문자열을 숫자 계산용 문자열로 */
export function parseNumberInput(text) {
  return String(text ?? '').replace(/,/g, '');
}

/** 환산 결과 표시 — 큰 금액은 정수로, 작은 금액은 소수 둘째 자리까지 */
export function formatAmount(value) {
  if (!Number.isFinite(value)) return '-';
  return value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(2);
}
