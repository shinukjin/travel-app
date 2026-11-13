# CLAUDE.md — Private Honeymoon Guide

이 파일은 Claude Code(및 기타 코딩 에이전트)가 이 저장소에서 작업할 때 읽는 프로젝트 안내입니다. **답변·커밋 메시지·주석은 한국어**를 우선합니다.

## 프로젝트 목적

스페인·포르투갈 신혼여행용 **개인 올인원 가이드**: 사용자 웹에서 일정·티켓·회화를 준비하고, Mobile에서 오프라인으로 보기·메모·사진·지도·기록. 사진 **원본은 기기에만** 두고 서버에는 메타데이터만 동기화합니다.

상세 명세: `docs/개발계획서.md`

## 저장소 구조

| 경로 | 기술 | 기본 포트 | 역할 |
|------|------|-----------|------|
| `supabase/` | Postgres SQL | — | 스키마·RLS·트리거 (`0001_init.sql`), 운영자 기능·접속 로그 (`0002_admin.sql`), 사용자 상세·편집 (`0003_admin_users.sql`), 관광지 카탈로그·운영 기록·인사이트 (`0004_catalog_insights.sql`), 비밀번호 관리·IP 정보 (`0005_password_ip.sql`), 장소 현지 이름 (`0006_place_local_name.sql`), DB는 Supabase |
| `backend/` | Spring Boot 3.3, H2 | 8080 | **더 이상 사용하지 않음** (Supabase 이전 전 구현, 이전 스크립트용으로만 보관) |
| `web/` | Vue 3 + Vite | 5173 | **사용자 웹**: 여행·일정·장소·티켓·회화·준비물 CRUD, 회원가입·로그인, Vercel 배포 |
| `admin/` | Vue 3 + Vite | 5174 | **운영 콘솔**(관리자 전용): 가입자·접속 대시보드, 인사이트, 사용자 관리, 접속 로그, 운영 기록, 관광지(좌표) 카탈로그 관리. 가입 없음, Vercel 별도 프로젝트 |
| `mobile/` | Expo ~58, React Native | 8081 (웹 미리보기) | Android Dev Client 대상 앱, Supabase 직접 호출 + 로그인 |
| `docs/` | Markdown | — | 개발계획서, `배포-가이드.md` (Supabase·Vercel) |
| `.claude/` | Claude Code 설정 | — | `settings.json` 공유, `settings.local.json`은 비공개 |

## 로컬 실행 (Windows)

PowerShell에서는 `&&` 체인이 깨질 수 있으므로 **작업 디렉터리를 각 폴더로 바꾼 뒤** 명령을 실행하세요. 포트: web 5173, admin 5174, mobile 웹 미리보기는 `npx expo start --web --port 8081`.

- 데이터는 Supabase. **로그인 필수** (앱·사용자 웹·운영 콘솔 모두 이메일 로그인), 접근 제어는 DB RLS(`owner_id = auth.uid()`)
- 최초 설정·Vercel 배포·데이터 이전·운영자 설정: `docs/배포-가이드.md`
- 운영 콘솔(`admin/`)은 DB `admins` 테이블에 등록된 계정만 로그인됨. 사용자 웹(`web/`)에는 운영 메뉴를 넣지 말 것. 관리자 기능은 `admin_*` SQL 함수로만 동작 (service_role 키 사용 금지)
- 데이터 계층: `web/src/supabaseApi.js` 와 `mobile/src/supabaseApi.js` 는 **동일 파일** — 수정 시 둘 다 고칠 것
- Android 네이티브 지도·ffmpeg: **Expo Go 불가** → `npx expo prebuild -p android` 후 `npx expo run:android`

## 비밀·환경 변수

- 루트 `.env`: `google_maps_api_key`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` — **커밋 금지**
- web: `web/.env`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` (템플릿 `web/.env.example`)
- admin(운영 콘솔): `admin/.env`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (템플릿 `admin/.env.example`)
- 모바일 키는 `mobile/app.config.js`가 루트 `.env`를 읽어 `extra`로 주입 (app.json 과 병합)
- Supabase는 **anon 키만** 사용. `service_role` 키는 어디에도 넣지 말 것
- Claude Code `permissions`에서 `.env` 읽기 거부됨 — 키 내용을 에이전트에 노출하지 말 것

## 백엔드·데이터

- `DataSeeder`: 스키마 보정 위주, **대량 샘플 trip 삽입 없음**
- 기존 H2 샘플 제거: `backend/data` 삭제 후 서버 재시작 또는 Admin에서 삭제

## 코딩 시 지침

1. **범위 최소화** — 요청과 무관한 파일·리팩터 금지
2. **기존 패턴 유지** — Java 패키지 구조, Vue SFC 스타일, RN `Screen` / `HubShell` / `theme.js` 토큰
3. **커밋** — 사용자가 명시적으로 요청할 때만. `.env`, credentials 커밋 금지
4. **Git 안전** — `git config` 변경, force push to main, hook 우회(`--no-verify`) 금지
5. **문서** — `README.md`에 머지 충돌 마커가 남아 있을 수 있음; 수정 시 HEAD 쪽(상세 안내) 기준으로 정리 권장

## Claude Code 이 저장소 설정

- 설정 파일: **루트** `.claude/settings.json` (여기서 `claude` 실행)
- `language: korean`, Expo 공식 플러그인 `expo@claude-plugins-official` 활성
- 개인 API 키: `.claude/settings.local.json` (gitignore)

## 테스트·검증 체크리스트 (기능 변경 시)

- [ ] 사용자 웹 5173 CRUD / 운영 콘솔 5174 로그인(관리자만)
- [ ] Mobile 웹 8081 — 홈·여행·지도 메뉴 뱃지·일정 패널·지도 마커
- [ ] Google API: Maps JavaScript, Geocoding, Places, Maps SDK for Android 활성 여부
- [ ] `app.config.js` / prebuild 변경 후 Expo 재시작 또는 `run:android`
