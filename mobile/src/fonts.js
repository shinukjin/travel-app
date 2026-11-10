import { StyleSheet } from 'react-native';

/** 번들 폰트: Pretendard(전체). RN은 굵기별 파일이 필요해 family로 매핑한다. */
export const FONT_FILES = {
  'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf')
};

const BY_WEIGHT = {
  100: 'Pretendard-Regular',
  200: 'Pretendard-Regular',
  300: 'Pretendard-Regular',
  400: 'Pretendard-Regular',
  normal: 'Pretendard-Regular',
  500: 'Pretendard-Medium',
  600: 'Pretendard-SemiBold',
  700: 'Pretendard-Bold',
  bold: 'Pretendard-Bold',
  800: 'Pretendard-ExtraBold',
  900: 'Pretendard-ExtraBold'
};

/** style의 fontWeight를 폰트 파일(family)로 바꿔 반환 */
export function withFont(style) {
  const flat = StyleSheet.flatten(style) || {};
  let family = BY_WEIGHT[String(flat.fontWeight ?? 400)] || 'Pretendard-Regular';
  // 작은 글씨의 800은 Bold로 (가독성) — 큰 제목만 ExtraBold
  if (family === 'Pretendard-ExtraBold' && (flat.fontSize ?? 14) < 20) family = 'Pretendard-Bold';
  return [flat, { fontFamily: family, fontWeight: 'normal' }];
}
