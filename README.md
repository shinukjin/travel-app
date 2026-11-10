<<<<<<< HEAD
# Private Honeymoon Guide

스페인·포르투갈 신혼여행용 개인 앱입니다. 관리자 웹에서 일정·바우처를 준비하고, 안드로이드 앱에서 오프라인으로 보고 메모·사진을 남깁니다. 사진 원본은 기기에만 두고 메타데이터만 서버에 저장합니다.

자세한 설계는 [docs/개발계획서.md](docs/개발계획서.md)를 보세요.

## 구성

| 폴더 | 역할 | 실행 |
|------|------|------|
| `backend/` | Spring Boot 3.3 + H2 API (`:8080`) | `cd backend && mvn spring-boot:run` |
| `admin/` | Vue 3 관리자 (`:5173`) | `cd admin && npm install && npm run dev` |
| `mobile/` | Expo Android 앱 | 아래 모바일 안내 |

H2 콘솔: [http://localhost:8080/h2-console](http://localhost:8080/h2-console)  
JDBC URL: `jdbc:h2:file:./data/honeymoon`

시드 데이터: 스페인 2026-10-01~07, 포르투갈 2026-10-08~12.

## 웹에서 앱 화면 보기

백엔드가 켜진 상태에서 브라우저로 안드로이드 레이아웃을 확인할 수 있습니다.

```bash
cd mobile
npx expo start --web --port 8081
```

주소: [http://localhost:8081](http://localhost:8081)  
Admin 왼쪽 메뉴 **앱 미리보기**로도 열 수 있습니다.

웹은 미리보기용입니다. 지도는 OpenStreetMap, 하이라이트 인코딩은 Android Dev Client에서만 됩니다.

## 모바일

Expo Go로는 지도·ffmpeg 네이티브 모듈을 쓸 수 없습니다. Dev Client가 필요합니다.

```bash
cd mobile
npx expo install
npx expo prebuild -p android
npx expo run:android
```

실기기에서 API를 쓰려면 `mobile/src/config.js`의 `API_BASE_URL`을 PC LAN IP로 바꾸세요. 에뮬레이터 기본값은 `http://10.0.2.2:8080`입니다.

지도가 비어 있으면 `mobile/app.json`의 `android.config.googleMaps.apiKey`에 Google Maps 키를 넣으세요.

하이라이트 mp4는 `ffmpeg-kit-react-native`가 들어간 Dev Client에서만 인코딩됩니다.

```bash
cd mobile
npx expo install ffmpeg-kit-react-native
```

설치 후 `npx expo prebuild -p android`를 다시 실행하세요.
=======
# travel-app
신혼여행갈때 사용하려고 만든 앱
>>>>>>> 73e359c68e3b415c6477999d27e559d6f2d3ed11
