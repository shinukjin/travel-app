import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  trips: 'cache.trips',
  schedules: 'cache.schedules',
  vouchers: 'cache.vouchers',
  phrases: 'cache.phrases',
  packing: 'cache.packing',
  memos: 'cache.memos',
  media: 'cache.media',
  fxRates: 'cache.fxRates',
  placeInfo: 'cache.placeInfo'
};

async function read(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

async function write(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getTrips: () => read(KEYS.trips, []),
  setTrips: (value) => write(KEYS.trips, value),
  getSchedules: () => read(KEYS.schedules, {}),
  setSchedules: (value) => write(KEYS.schedules, value),
  getVouchers: () => read(KEYS.vouchers, {}),
  setVouchers: (value) => write(KEYS.vouchers, value),
  getPhrases: () => read(KEYS.phrases, {}),
  setPhrases: (value) => write(KEYS.phrases, value),
  getPacking: () => read(KEYS.packing, {}),
  setPacking: (value) => write(KEYS.packing, value),
  getMemos: () => read(KEYS.memos, []),
  setMemos: (value) => write(KEYS.memos, value),
  getMedia: () => read(KEYS.media, []),
  setMedia: (value) => write(KEYS.media, value),
  getFxRates: () => read(KEYS.fxRates, null),
  setFxRates: (value) => write(KEYS.fxRates, value),
  getPlaceInfo: () => read(KEYS.placeInfo, {}),
  setPlaceInfo: (value) => write(KEYS.placeInfo, value)
};
