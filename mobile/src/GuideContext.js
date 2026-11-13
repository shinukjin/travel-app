import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { storage } from './storage';
import { loadGuideCache, refreshGuideCache } from './sync';
import { formatTime } from './theme';

const GuideContext = createContext(null);

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 홈의 여행 선택 순서 — 진행 중·예정 여행을 출발일이 가까운 순으로 먼저, 이미 끝난 여행은 뒤로(최근에 끝난 순).
 * 기본으로 선택되는 여행도 이 순서의 첫 번째다.
 */
export function sortTripsForHome(trips = []) {
  const today = localToday();
  const isDone = (t) => Boolean(t.endDate) && t.endDate < today;
  const upcoming = trips
    .filter((t) => !isDone(t))
    .sort((a, b) => String(a.startDate || '9999').localeCompare(String(b.startDate || '9999')));
  const done = trips.filter(isDone).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  return [...upcoming, ...done];
}

export function GuideProvider({ children }) {
  const navigation = useNavigation();
  const [data, setData] = useState({ trips: [], schedules: {}, vouchers: {}, phrases: {}, packing: {} });
  const [tripId, setTripId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    const cached = await loadGuideCache();
    setData({ ...cached, packing: cached.packing || {} });
    setTripId((prev) => {
      if (prev && cached.trips.some((t) => t.id === prev)) return prev;
      return sortTripsForHome(cached.trips)[0]?.id ?? null;
    });
    try {
      const fresh = await refreshGuideCache();
      setData({ ...fresh, packing: fresh.packing || {} });
      setTripId((prev) => (prev && fresh.trips.some((t) => t.id === prev) ? prev : sortTripsForHome(fresh.trips)[0]?.id ?? null));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectTrip = useCallback(
    (id) => setTripId(id),
    []
  );

  const patchData = useCallback((patch) => {
    setData((current) => ({ ...current, ...patch }));
  }, []);

  const setPackingForTrip = useCallback(
    (list) => {
      if (!tripId) return;
      setData((current) => {
        const packingMap = { ...current.packing, [tripId]: list };
        storage.setPacking(packingMap);
        return { ...current, packing: packingMap };
      });
    },
    [tripId]
  );

  const editTrip = useCallback(
    (tripOrId) => {
      const id = typeof tripOrId === 'object' ? tripOrId?.id : tripOrId;
      if (id) {
        navigation.navigate('Tabs', {
          screen: '도구',
          params: { section: 'settings', editTripId: id }
        });
      }
    },
    [navigation]
  );

  const trip = useMemo(() => data.trips.find((item) => item.id === tripId), [data.trips, tripId]);
  const days = trip ? data.schedules[trip.id] || [] : [];
  const vouchers = trip ? data.vouchers[trip.id] || [] : [];
  const phrases = trip ? data.phrases[trip.id] || [] : [];
  const packing = trip ? data.packing[trip.id] || [] : [];

  const today = new Date().toISOString().slice(0, 10);
  const nowHm = new Date().toTimeString().slice(0, 5);
  const todayDay = days.find((d) => d.date === today) || days[0];
  const todayItems = todayDay?.items || [];
  const nextStop = !todayItems.length
    ? null
    : todayDay?.date === today
      ? todayItems.find((item) => formatTime(item.startTime) >= nowHm) || todayItems[todayItems.length - 1]
      : todayItems[0];

  const packedCount = packing.filter((item) => item.packed).length;

  const value = useMemo(
    () => ({
      data,
      trip,
      tripId,
      trips: data.trips,
      days,
      vouchers,
      phrases,
      packing,
      loading,
      offline,
      selectTrip,
      patchData,
      setPackingForTrip,
      editTrip,
      nextStop,
      todayDay,
      packedCount,
      refresh: load
    }),
    [
      data,
      trip,
      tripId,
      days,
      vouchers,
      phrases,
      packing,
      loading,
      offline,
      selectTrip,
      patchData,
      setPackingForTrip,
      editTrip,
      nextStop,
      todayDay,
      packedCount,
      load
    ]
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide must be used within GuideProvider');
  return ctx;
}
