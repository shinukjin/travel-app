export const PEEK_BODY = 76;
export const TAB_CLEARANCE = 72;

export function computeSnaps(frame, bottomInset = 0) {
  const peek = PEEK_BODY + bottomInset;
  const half = Math.round(frame * 0.52);
  const full = Math.max(half + 48, frame - TAB_CLEARANCE);
  const min = peek;
  const max = Math.max(full, half);
  return { peek, half, full, min, max };
}

export function modeFromHeight(h, snaps) {
  const dist = (target) => Math.abs(h - target);
  if (dist(snaps.peek) <= dist(snaps.half) && dist(snaps.peek) <= dist(snaps.full)) return 'peek';
  if (dist(snaps.half) <= dist(snaps.full)) return 'half';
  return 'full';
}

export function clampHeight(h, snaps) {
  return Math.min(snaps.max, Math.max(snaps.min, h));
}
