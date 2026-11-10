import Constants from 'expo-constants';

export function getGoogleMapsApiKey() {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? Constants.manifest?.extra;
  const fromExtra = extra?.googleMapsApiKey;
  if (fromExtra) return fromExtra;
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  }
  return '';
}
