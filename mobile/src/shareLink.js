/**
 * 공유 링크 — 앱 전용 링크 honeymoon://share/<토큰>
 * 링크로 앱이 열리면 토큰을 "대기" 상태로 두었다가, 로그인과 데이터 로딩이 끝난 뒤 가져오기 화면으로 보낸다.
 */
export const LINK_SCHEME = 'honeymoon';

export const buildShareLink = (token) => `${LINK_SCHEME}://share/${token}`;

/** 링크가 포함된 글이나 토큰만 붙여넣어도 토큰을 뽑는다. 없으면 null */
export function parseShareToken(input) {
  const text = String(input || '').trim();
  const fromLink = new RegExp(`${LINK_SCHEME}://share/([A-Za-z0-9]{12,40})`, 'i').exec(text);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9]{20}$/.test(text) ? text : null;
}

let pending = null;
const listeners = new Set();

/** 링크로 앱이 열렸을 때 토큰을 기록하고, 이미 듣고 있는 화면이 있으면 바로 알린다 */
export function setPendingShare(token) {
  pending = token;
  listeners.forEach((fn) => fn(token));
}

/** 대기 중인 토큰을 꺼낸다 (한 번 꺼내면 비워진다) */
export function takePendingShare() {
  const token = pending;
  pending = null;
  return token;
}

export function subscribePendingShare(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 앱에 들어온 URL 하나를 처리한다 */
export function handleIncomingUrl(url) {
  const token = parseShareToken(url);
  if (token) setPendingShare(token);
}

/** 만료일 표시 — "5월 27일까지" */
export function expiryText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일까지`;
}
