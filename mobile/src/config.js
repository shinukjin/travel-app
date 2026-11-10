import { Platform } from 'react-native';

// Android 에뮬레이터는 10.0.2.2, 실기기는 PC의 LAN IP로 바꾸세요.
export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://localhost:8080'
});
