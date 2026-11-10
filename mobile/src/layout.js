import { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const LayoutContext = createContext(null);

/** 넓은 내면·태블릿에서 본문 최대 폭 */
export const CONTENT_MAX_WIDTH = 920;

/**
 * compact  ~ 커버·좁은 폰 (<520)
 * medium   일반 폰 (520–719)
 * expanded Z Fold 펼침·큰 폰 (720–959)
 * wide     태블릿·가로 넓은 화면 (960+)
 */
export function deriveLayout(width, height) {
  const tier =
    width >= 960 ? 'wide' : width >= 720 ? 'expanded' : width >= 520 ? 'medium' : 'compact';

  const contentMaxWidth = width >= 720 ? Math.min(width, CONTENT_MAX_WIDTH) : width;
  const gutter = width >= 720 ? 28 : width >= 520 ? 20 : 16;
  const tabSideInset = Math.max(16, Math.round((width - contentMaxWidth) / 2) + 16);
  const gridColumns = width >= 960 ? 4 : width >= 720 ? 3 : width >= 520 ? 2 : 1;

  return {
    width,
    height,
    tier,
    contentMaxWidth,
    gutter,
    tabSideInset,
    gridColumns,
    /** 하단 탭 5개를 스크롤 없이 펼침 */
    distributeTabs: width >= 520,
    /** 홈 바로가기를 가로 스크롤 대신 격자 */
    shortcutGrid: width >= 720,
    /** 홈 벤토를 세로 스택 (매우 좁을 때) */
    bentoStacked: width < 400,
    photoThumbWidth: width >= 960 ? '23%' : width >= 720 ? '31%' : '48%'
  };
}

export function LayoutProvider({ children }) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => deriveLayout(width, height), [width, height]);
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) return deriveLayout(390, 844);
  return ctx;
}
