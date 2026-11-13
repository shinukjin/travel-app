import { formatTime } from './theme';

/**
 * 지금 시각 기준으로 지도에서 보여 줄 일정(좌표가 있는 장소만 대상).
 * - 오늘 날짜: 이미 시작한 일정 중 가장 늦은 것(= 지금 진행 중), 아직 시작한 게 없으면 가장 가까운 다음 일정
 * - 다른 날짜: 그날 첫 일정
 * 시간이 없는 일정은 순서대로 두되, 시간 비교에서는 제외한다.
 */
export function pickCurrentStop(markers, date) {
  if (!markers?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (date !== today) return markers[0];
  const nowHm = new Date().toTimeString().slice(0, 5);
  const timed = markers.filter((item) => /^\d{2}:\d{2}$/.test(formatTime(item.startTime)));
  if (!timed.length) return markers[0];
  const started = timed.filter((item) => formatTime(item.startTime) <= nowHm);
  if (started.length) return started[started.length - 1];
  return timed[0];
}
