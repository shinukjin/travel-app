import Constants from 'expo-constants';
import * as Application from 'expo-application';

/** app.json 의 version (사용자에게 보이는 버전) */
export const APP_VERSION = Constants.expoConfig?.version || Application.nativeApplicationVersion || '0.0.0';

/** 빌드 번호 — Android versionCode (EAS autoIncrement 로 빌드마다 증가). 웹 미리보기에서는 없다 */
export const APP_BUILD = Application.nativeBuildVersion || null;

/** 예: "v1.0.0 (12)" */
export const APP_VERSION_LABEL = APP_BUILD ? `v${APP_VERSION} (${APP_BUILD})` : `v${APP_VERSION}`;
