import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGuide } from '../GuideContext';
import ExploreMap from '../components/ExploreMap';
import { fetchNearbyAttractions, navigatePlaceInfo } from '../placeInfo';
import { NEARBY_KINDS } from '../maps/googleNearby';
import { withTimeout } from '../timeout';
import { colors, radius, shadow, space, type } from '../theme';
import { Button, Icon, Surface } from '../ui';

function firstPlannedCoords(days) {
  for (const day of days || []) {
    const item = (day.items || []).find((row) => row.place?.lat != null && row.place?.lng != null);
    if (item) return { lat: item.place.lat, lng: item.place.lng, label: item.place.name };
  }
  return null;
}

/** 현재 위치 — 권한 요청이나 GPS 응답이 없어도 멈추지 않게 제한 시간을 두고, 안 되면 마지막 위치를 쓴다 */
async function currentCoords() {
  try {
    const perm = await withTimeout(Location.requestForegroundPermissionsAsync(), 8000);
    if (perm.status !== 'granted') return null;
    try {
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
      return pos.coords;
    } catch {
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      return last?.coords || null;
    }
  } catch {
    return null;
  }
}

export default function NearbyScreen({ embed }) {
  const navigation = useNavigation();
  const { days, nextStop } = useGuide();
  const [center, setCenter] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  // 식당·카페·관광지 등 분류 — 바꿔도 위치(GPS)는 다시 잡지 않고 같은 기준점에서 다시 검색한다
  const [kind, setKind] = useState('sight');
  const kindRef = useRef('sight');
  const centerRef = useRef(null);
  const kindInfo = NEARBY_KINDS.find((k) => k.id === kind) || NEARBY_KINDS[0];

  // 일정 데이터가 바뀔 때마다 검색이 다시 돌지 않도록, 최신 값은 ref 로 읽는다
  const planRef = useRef({ days, nextStop });
  planRef.current = { days, nextStop };
  const runRef = useRef(0);

  const load = useCallback(async () => {
    const run = ++runRef.current;
    const stale = () => run !== runRef.current; // 더 새 검색이 시작됐으면 이전 결과는 버린다
    setLoading(true);
    setError('');
    try {
      let lat;
      let lng;
      let source = '일정';
      const here = await currentCoords();
      if (stale()) return;
      if (here) {
        lat = here.latitude;
        lng = here.longitude;
        source = '현재 위치';
      }
      const { days: plannedDays, nextStop: next } = planRef.current;
      if (lat == null && next?.place?.lat != null) {
        lat = next.place.lat;
        lng = next.place.lng;
        source = '다음 일정';
      }
      if (lat == null) {
        const planned = firstPlannedCoords(plannedDays);
        if (planned) {
          lat = planned.lat;
          lng = planned.lng;
          source = planned.label || '일정';
        }
      }
      if (lat == null) {
        setError('현재 위치를 가져오지 못했고, 일정에도 위치가 있는 장소가 없어요. 위치 권한을 허용하거나 일정에 장소를 추가해 주세요.');
        setItems([]);
        setCenter(null);
        return;
      }
      setCenter({ lat, lng, label: source, source });
      centerRef.current = { lat, lng };
      const list = await fetchNearbyAttractions(lat, lng, 1200, kindRef.current);
      if (stale()) return;
      setItems(list);
      setSelectedId(null);
    } catch (e) {
      if (stale()) return;
      setError(e.message || '주변 검색에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
      setItems([]);
    } finally {
      if (!stale()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** 분류를 바꾼다 — 기준점이 이미 있으면 같은 곳에서 다시 검색만 한다 */
  const pickKind = async (id) => {
    if (id === kindRef.current) return;
    kindRef.current = id;
    setKind(id);
    setSelectedId(null);
    const at = centerRef.current;
    if (!at) {
      load();
      return;
    }
    const run = ++runRef.current;
    setLoading(true);
    setError('');
    try {
      const list = await fetchNearbyAttractions(at.lat, at.lng, 1200, id);
      if (run !== runRef.current) return;
      setItems(list);
    } catch (e) {
      if (run !== runRef.current) return;
      setError(e.message || '주변 검색에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
      setItems([]);
    } finally {
      if (run === runRef.current) setLoading(false);
    }
  };

  const distanceText = (m) => (m == null ? '' : m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

  const listBody = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kindScroll} contentContainerStyle={styles.kindRow}>
        {NEARBY_KINDS.map((k) => {
          const on = k.id === kind;
          return (
            <Pressable
              key={k.id}
              onPress={() => pickKind(k.id)}
              style={({ pressed }) => [styles.kindChip, on && styles.kindChipOn, pressed && styles.kindChipPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${k.label} 찾기`}
            >
              <Icon name={k.icon} size={15} color={on ? colors.accentDark : colors.muted} />
              <Text style={[styles.kindText, on && styles.kindTextOn]}>{k.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {center ? (
        <Text style={type.meta}>
          기준: {center.source} · 가까운 순 · 약 1.2km
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button label="다시 시도" onPress={load} variant="ghost" />
        </>
      ) : items.length ? (
        <Surface inset={false}>
          {items.map((place, index) => (
            <View key={place.id}>
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  (pressed || selectedId === place.id) && styles.rowOn
                ]}
                onPress={() => {
                  setSelectedId(place.id);
                  navigatePlaceInfo(navigation, place);
                }}
              >
                <View style={styles.icon}>
                  <Icon name={kindInfo.icon} size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {place.memo || place.address ? (
                    <Text style={type.meta} numberOfLines={1}>
                      {[distanceText(place.distanceM), place.memo || place.address].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
              {index < items.length - 1 ? <View style={styles.hair} /> : null}
            </View>
          ))}
        </Surface>
      ) : (
        <>
          <Text style={type.meta}>근처에 표시할 {kindInfo.label}이(가) 없어요.</Text>
          <Button label="다시 검색" onPress={load} variant="ghost" />
        </>
      )}
      <Text style={styles.footnote}>Google Maps · Places API</Text>
    </>
  );

  if (embed) {
    return (
      <View style={styles.embedRoot}>
        {center ? (
          <ExploreMap
            compact
            places={items}
            center={center}
            selectedId={selectedId}
            onSelectPlace={(place) => {
              setSelectedId(place.id);
              navigatePlaceInfo(navigation, place);
            }}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            {loading ? <ActivityIndicator color={colors.accent} /> : <Text style={type.meta}>지도 준비 중</Text>}
          </View>
        )}
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
          {listBody}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.standalone} contentContainerStyle={styles.listPad}>
      {center ? (
        <View style={styles.mapBlock}>
          <ExploreMap
            compact
            places={items}
            center={center}
            selectedId={selectedId}
            onSelectPlace={(place) => {
              setSelectedId(place.id);
              navigatePlaceInfo(navigation, place);
            }}
          />
        </View>
      ) : null}
      {listBody}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kindScroll: { flexGrow: 0 },
  kindRow: { gap: space.sm, paddingRight: space.lg },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  kindChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  kindChipPressed: { opacity: 0.7 },
  kindText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  kindTextOn: { color: colors.accentDark },
  embedRoot: { flex: 1, minHeight: 0 },
  mapPlaceholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.map
  },
  listScroll: { flex: 1, minHeight: 0 },
  listPad: { gap: space.md, padding: space.lg, paddingBottom: space.xxl },
  standalone: { flex: 1, backgroundColor: colors.bg },
  mapBlock: { height: 240, marginBottom: space.md },
  error: { ...type.body, color: colors.danger },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg
  },
  rowOn: { backgroundColor: colors.surfaceMuted },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hair: { height: 1, backgroundColor: colors.lineHair, marginLeft: 40 + space.lg + space.md },
  footnote: { ...type.caption, textAlign: 'center', color: colors.faint }
});
