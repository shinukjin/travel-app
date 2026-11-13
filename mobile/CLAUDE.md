## 모바일 앱 구조 (요약)

- 진입: `mobile/App.js` — 하단 탭(홈·여행·**지도**·기록·도구), 스택에 `장소` 상세
- **지도 탭**: 하단 메인 탭바 숨김, `MapHubMenuBadge` 뱃지 → 메뉴(일정 지도 / 주변 탐색 + 다른 탭 이동)
- 지도: Google Maps (웹 `GoogleMap.web.js`, 네이티브 `MapScreen.native.js` + `PROVIDER_GOOGLE`)
- 일정 패널: `MapSheet.*`, 스냅 `mapSheetSnap.js`, 드래그로 peek/half/full
- 레이아웃: `mobile/src/layout.js` (`LayoutProvider`) — Fold·넓은 화면 대응
- 데이터: `GuideProvider`, `loadGuideCache` / 동기화 — **시드 샘플 데이터 제거됨**, 사용자 웹 또는 앱에서 직접 입력

주요 경로:

- `mobile/src/screens/*HubScreen.js` — 탭별 허브
- `mobile/src/components/MapHubMenuBadge.js`, `MapSheet.*.js`
- `mobile/src/mapsConfig.js`, `web/src/mapsKey.js`
