export const TAB_ROUTES = {
  home: '홈',
  travel: '여행',
  map: '지도',
  record: '기록',
  tools: '도구'
};

export const STACK_ROUTES = {
  place: '장소'
};

export const TOOL_TINTS = {
  travel: { tint: '#DFE8F6', iconColor: '#1F4FA3' },
  map: { tint: '#D5EEEE', iconColor: '#0F7C7C' },
  record: { tint: '#E9E3F5', iconColor: '#6B4FA3' },
  tools: { tint: '#FCEFD2', iconColor: '#A56A00' },
  settings: { tint: '#E9EFF5', iconColor: '#5B6B7F' }
};

/** 홈 상단 가로 스크롤 바로가기 */
export function hubShortcuts() {
  return [
    {
      key: 'travel',
      label: '여행',
      hint: '일정·준비·티켓',
      icon: 'calendar',
      route: TAB_ROUTES.travel,
      section: 'schedule',
      ...TOOL_TINTS.travel
    },
    {
      key: 'map',
      label: '지도',
      hint: '경로·주변 탐색',
      icon: 'map',
      route: TAB_ROUTES.map,
      section: 'map',
      ...TOOL_TINTS.map
    },
    {
      key: 'record',
      label: '기록',
      hint: '메모·사진',
      icon: 'images',
      route: TAB_ROUTES.record,
      section: 'memo',
      ...TOOL_TINTS.record
    },
    {
      key: 'tools',
      label: '도구',
      hint: '환율·회화',
      icon: 'cash',
      route: TAB_ROUTES.tools,
      section: 'exchange',
      ...TOOL_TINTS.tools
    },
    {
      key: 'settings',
      label: '설정',
      hint: '여행 관리',
      icon: 'settings',
      route: TAB_ROUTES.tools,
      section: 'settings',
      ...TOOL_TINTS.settings
    }
  ];
}

export function navigateHub(navigation, item) {
  navigation.navigate('Tabs', {
    screen: item.route,
    params: { section: item.section }
  });
}

/** 홈 빠른 실행 격자 (4열) */
export function quickActions() {
  return [
    { key: 'schedule', label: '일정', icon: 'calendar', route: TAB_ROUTES.travel, section: 'schedule', ...TOOL_TINTS.travel },
    { key: 'map', label: '지도', icon: 'map', route: TAB_ROUTES.map, section: 'map', ...TOOL_TINTS.map },
    { key: 'voucher', label: '티켓', icon: 'ticket', route: TAB_ROUTES.travel, section: 'voucher', ...TOOL_TINTS.tools },
    { key: 'packing', label: '준비물', icon: 'bag-check', route: TAB_ROUTES.travel, section: 'packing', ...TOOL_TINTS.record },
    { key: 'exchange', label: '환율', icon: 'cash', route: TAB_ROUTES.tools, section: 'exchange', ...TOOL_TINTS.tools },
    { key: 'phrase', label: '회화', icon: 'chatbubbles', route: TAB_ROUTES.tools, section: 'phrase', ...TOOL_TINTS.travel },
    { key: 'memo', label: '메모', icon: 'create', route: TAB_ROUTES.record, section: 'memo', ...TOOL_TINTS.record },
    { key: 'photos', label: '사진', icon: 'images', route: TAB_ROUTES.record, section: 'memories', ...TOOL_TINTS.map }
  ];
}
