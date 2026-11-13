/** 아줄레주 + 리스본 트램 — 타일 화이트 / 잉크 네이비 / 코발트 / 트램 옐로(유일한 강조) */
export const colors = {
  bg: '#F7F9FB',
  bgTop: '#EEF3F8',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#E9EFF5',
  surfaceTint: '#F0F5FA',
  ink: '#10263F',
  muted: '#5B6B7F',
  faint: '#93A1B2',
  accent: '#1F4FA3',
  accentDark: '#173D82',
  accentSoft: '#DFE8F6',
  accentGlow: 'rgba(31, 79, 163, 0.14)',
  navy: '#10263F',
  tram: '#F2B33D',
  tramSoft: '#FCEFD2',
  /** 트램 옐로 위에 올리는 글씨 — 남색 대신 짙은 호박색 (대비 약 7:1) */
  tramInk: '#4A3300',
  forest: '#2F8F6B',
  forestSoft: '#D9F0E6',
  /** 연한 민트 배경 위 글씨 — 대비 약 7:1 */
  forestInk: '#1B5B43',
  sand: '#F1F5F9',
  line: '#DCE4EC',
  lineHair: 'rgba(16, 38, 63, 0.08)',
  map: '#E0EEF8',
  overlay: 'rgba(16, 38, 63, 0.5)',
  danger: '#C0392B',
  tabBar: '#FFFFFF'
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

/** 위계: 컨트롤 < 카드 < 시트 */
export const radius = {
  sm: 10,
  control: 12,
  card: 16,
  sheet: 20,
  pill: 999
};

export const type = {
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.ink },
  section: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: colors.ink },
  body: { fontSize: 16, fontWeight: '400', color: colors.ink, lineHeight: 24 },
  meta: { fontSize: 13, fontWeight: '500', color: colors.muted, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0 }
};

export const TAB_BAR_BASE = 64;
export const TAB_BAR_FLOAT = 0;

export function contentPad(bottomInset = 0, topInset = 0, gutter = 20) {
  const paddingTop = topInset > 0 ? topInset + space.sm : space.lg;
  return {
    paddingHorizontal: gutter,
    paddingTop,
    paddingBottom: TAB_BAR_BASE + bottomInset + TAB_BAR_FLOAT + space.xl
  };
}

/** @deprecated use contentPad(insets.bottom) via Screen */
export const screenPad = contentPad(0);

export const shadow = {
  card: {
    shadowColor: '#10263F',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  float: {
    shadowColor: '#10263F',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  tab: {
    shadowColor: '#10263F',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8
  }
};

/** 하단 고정(도킹) 탭바 — 떠 있는 알약 대신 헤어라인으로 구분 */
export function tabBarStyleForInset(bottomInset = 0, sideInset = 0) {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_BAR_BASE + bottomInset,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
    paddingBottom: bottomInset > 0 ? bottomInset : 6,
    paddingHorizontal: Math.min(sideInset, 8),
    ...shadow.tab
  };
}

export const tabBarStyle = tabBarStyleForInset(0);

/** 지도 등 — 하단 탭 완전 숨김 (웹 tablist 잔상 방지) */
export const hiddenTabBarStyle = {
  display: 'none',
  height: 0,
  minHeight: 0,
  opacity: 0,
  overflow: 'hidden',
  pointerEvents: 'none'
};

export const categoryMeta = {
  FOOD: { label: '맛집', icon: 'restaurant', color: '#C2410C', soft: '#FCE8D8' },
  SIGHT: { label: '관광', icon: 'camera', color: '#1F4FA3', soft: '#DFE8F6' },
  STAY: { label: '숙소', icon: 'bed', color: '#6B4FA3', soft: '#E9E3F5' },
  TRANSIT: { label: '교통', icon: 'airplane', color: '#0F7C7C', soft: '#D5EEEE' }
};

export const voucherMeta = {
  FLIGHT: { label: '항공', icon: 'airplane' },
  HOTEL: { label: '호텔', icon: 'bed' },
  TICKET: { label: '티켓', icon: 'ticket' }
};

export const packingMeta = {
  DOCS: { label: '서류', icon: 'document-text' },
  CLOTHES: { label: '의류', icon: 'shirt' },
  GEAR: { label: '전자기기', icon: 'phone-portrait' },
  TOILETRY: { label: '세면', icon: 'water' },
  MEDICINE: { label: '약', icon: 'medkit' },
  OTHER: { label: '기타', icon: 'cube' }
};

export { countryFlag, countryLabel, countryLabels, parseCountries } from './countries';

export function formatRange(start, end) {
  if (!start || !end) return '';
  const a = start.split('-');
  const b = end.split('-');
  return `${Number(a[1])}.${Number(a[2])} – ${Number(b[1])}.${Number(b[2])}`;
}

export function formatWeek(date) {
  if (!date) return '';
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00`).getDay()] || '';
}

export function formatDay(date) {
  if (!date) return '';
  const [, m, d] = date.split('-');
  return `${Number(m)}월 ${Number(d)}일 (${formatWeek(date)})`;
}

export function formatTime(value) {
  return value ? String(value).slice(0, 5) : '—';
}
