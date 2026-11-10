const TZ = 'Asia/Seoul';

const dateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

/** 2026-11-10 14:30 (한국 시간) */
export function fmtDateTime(value) {
  if (!value) return '-';
  const parts = Object.fromEntries(dateTime.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function fmtDate(value) {
  return fmtDateTime(value).slice(0, 10);
}

/** "3분 전", "2시간 전", "5일 전" */
export function fromNow(value) {
  if (!value) return '접속 기록 없음';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 31) return `${day}일 전`;
  return fmtDate(value);
}

export const EVENT_LABELS = { signup: '가입', login: '로그인', app_open: '앱 실행', logout: '로그아웃' };
export const PLATFORM_LABELS = { 'web-admin': '운영 콘솔', android: 'Android', ios: 'iOS', web: '사용자 웹', unknown: '알 수 없음' };
