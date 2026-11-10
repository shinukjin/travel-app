import { api } from './api';
import { storage } from './storage';

export async function refreshGuideCache() {
  const trips = await api.trips();
  const schedules = {};
  const vouchers = {};
  const phrases = {};
  const packing = {};
  for (const trip of trips) {
    schedules[trip.id] = await api.schedules(trip.id);
    vouchers[trip.id] = await api.vouchers(trip.id);
    phrases[trip.id] = await api.phrases(trip.id);
    packing[trip.id] = await api.packing(trip.id);
  }
  await storage.setTrips(trips);
  await storage.setSchedules(schedules);
  await storage.setVouchers(vouchers);
  await storage.setPhrases(phrases);
  await storage.setPacking(packing);
  return { trips, schedules, vouchers, phrases, packing };
}

export async function clearGuideCache() {
  await storage.setTrips([]);
  await storage.setSchedules({});
  await storage.setVouchers({});
  await storage.setPhrases({});
  await storage.setPacking({});
  return { trips: [], schedules: {}, vouchers: {}, phrases: {}, packing: {} };
}

export async function loadGuideCache() {
  const [trips, schedules, vouchers, phrases, packing] = await Promise.all([
    storage.getTrips(),
    storage.getSchedules(),
    storage.getVouchers(),
    storage.getPhrases(),
    storage.getPacking()
  ]);
  return { trips, schedules, vouchers, phrases, packing };
}

export function matchTripByDate(trips, isoDate) {
  const date = isoDate.slice(0, 10);
  return trips.find((trip) => trip.startDate <= date && date <= trip.endDate) || null;
}

export async function syncPendingMemos() {
  const memos = await storage.getMemos();
  const pending = memos.filter((memo) => memo.syncStatus === 'pending');
  for (const memo of pending) {
    try {
      await api.saveMemo({
        tripId: memo.tripId,
        content: memo.content,
        photoUri: memo.photoUri,
        lat: memo.lat,
        lng: memo.lng,
        createdAt: memo.createdAt,
        clientId: memo.clientId
      });
      memo.syncStatus = 'synced';
    } catch {
      memo.syncStatus = 'pending';
    }
  }
  await storage.setMemos(memos);
  return memos;
}

export async function syncPendingMedia() {
  const media = await storage.getMedia();
  const pending = media.filter((item) => item.syncStatus === 'pending');
  for (const item of pending) {
    try {
      await api.saveMediaLog({
        tripId: item.tripId,
        localUri: item.localUri,
        mediaType: item.mediaType,
        capturedAt: item.capturedAt,
        lat: item.lat,
        lng: item.lng
      });
      item.syncStatus = 'synced';
    } catch {
      item.syncStatus = 'pending';
    }
  }
  await storage.setMedia(media);
  return media;
}
