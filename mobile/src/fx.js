import { storage } from './storage';

const DEFAULT_RATES = {
  EUR_KRW: 1450,
  EUR_USD: 1.08,
  USD_KRW: 1340,
  updatedAt: null
};

export async function loadFxRates() {
  const saved = await storage.getFxRates();
  return { ...DEFAULT_RATES, ...saved };
}

export async function refreshFxRates() {
  const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=KRW,USD');
  if (!res.ok) throw new Error('환율 조회 실패');
  const json = await res.json();
  const eurKrw = json.rates?.KRW;
  const eurUsd = json.rates?.USD;
  if (!eurKrw || !eurUsd) throw new Error('환율 데이터 없음');
  const usdKrw = eurKrw / eurUsd;
  const payload = {
    EUR_KRW: eurKrw,
    EUR_USD: eurUsd,
    USD_KRW: usdKrw,
    updatedAt: json.date || new Date().toISOString().slice(0, 10)
  };
  await storage.setFxRates(payload);
  return payload;
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

/** 환율 직접 입력 — 저장 후에는 자동 갱신이 덮어쓰지 않는다 (manual: true) */
export async function saveManualRates(eurKrw, usdKrw) {
  const eur = Number(eurKrw);
  const usd = Number(usdKrw);
  if (!Number.isFinite(eur) || !Number.isFinite(usd) || eur <= 0 || usd <= 0) {
    throw new Error('환율은 0보다 큰 숫자여야 합니다');
  }
  const payload = {
    EUR_KRW: eur,
    USD_KRW: usd,
    EUR_USD: eur / usd,
    updatedAt: new Date().toISOString().slice(0, 10),
    manual: true
  };
  await storage.setFxRates(payload);
  return payload;
}

export function convertAmount(amount, from, to, rates) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return 0;
  const toKrw = (cur, val) => {
    if (cur === 'KRW') return val;
    if (cur === 'EUR') return val * rates.EUR_KRW;
    if (cur === 'USD') return val * rates.USD_KRW;
    return val;
  };
  const fromKrw = toKrw(from, n);
  if (to === 'KRW') return fromKrw;
  if (to === 'EUR') return fromKrw / rates.EUR_KRW;
  if (to === 'USD') return fromKrw / rates.USD_KRW;
  return fromKrw;
}
