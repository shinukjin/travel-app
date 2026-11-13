import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useGuide } from '../GuideContext';
import ExploreMap from '../components/ExploreMap';
import MapSheet from '../components/MapSheet';
import { computeSnaps } from '../components/mapSheetSnap';
import { useMapExpand } from '../hooks/useMapExpand';
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
  // 화면에 들어왔다고 바로 검색하지 않는다 — 분류 칩이나 "내 주변 찾기"를 눌렀을 때만 조회(API 호출)
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
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

  /** 일정 기준점 — 다음 일정, 없으면 일정의 첫 장소 (GPS·API 호출 없음) */
  const plannedCenter = useCallback(() => {
    const { days: plannedDays, nextStop: next } = planRef.current;
    if (next?.place?.lat != null) return { lat: next.place.lat, lng: next.place.lng, source: '다음 일정' };
    const planned = firstPlannedCoords(plannedDays);
    if (planned) return { lat: planned.lat, lng: planned.lng, source: planned.label || '일정' };
    return null;
  }, []);

  /** 검색 기준점 — 현재 위치, 없으면 일정 (Places 호출 없음) */
  const resolveCenter = useCallback(async () => {
    const here = await currentCoords();
    if (here) return { lat: here.latitude, lng: here.longitude, source: '현재 위치' };
    return plannedCenter();
  }, [plannedCenter]);

  // 들어오면 검색은 하지 않고 지도만 보여 준다 — 일정 위치로 먼저 띄우고, 현재 위치(GPS)를 잡으면 그쪽으로 옮긴다
  useEffect(() => {
    let alive = true;
    const first = plannedCenter();
    if (first && !centerRef.current) {
      centerRef.current = { lat: first.lat, lng: first.lng };
      setCenter({ ...first, label: first.source });
    }
    (async () => {
      const here = await currentCoords();
      if (!alive || !here || runRef.current > 0) return; // 이미 검색을 시작했으면 건드리지 않는다
      centerRef.current = { lat: here.latitude, lng: here.longitude };
      setCenter({ lat: here.latitude, lng: here.longitude, label: '현재 위치', source: '현재 위치' });
    })();
    return () => {
      alive = false;
    };
  }, [plannedCenter]);

  /** at 기준 주변 검색 — run 이 더 새 검색에 밀리면 결과를 버린다 */
  const runSearch = async (run, at, kindId) => {
    const stale = () => run !== runRef.current;
    setSearched(true);
    setLoading(true);
    setError('');
    try {
      const list = await fetchNearbyAttractions(at.lat, at.lng, 1200, kindId);
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
  };

  /** "내 주변 찾기" — 현재 위치(없으면 일정)를 기준으로 검색 */
  const load = useCallback(async () => {
    const run = ++runRef.current;
    setSearched(true);
    setLoading(true);
    setError('');
    const at = await resolveCenter();
    if (run !== runRef.current) return;
    if (!at) {
      setError('현재 위치를 가져오지 못했고, 일정에도 위치가 있는 장소가 없어요. 위치 권한을 허용하거나 일정에 장소를 추가해 주세요.');
      setItems([]);
      setCenter(null);
      setLoading(false);
      return;
    }
    setCenter({ ...at, label: at.source });
    centerRef.current = { lat: at.lat, lng: at.lng };
    runSearch(run, at, kindRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveCenter]);

  /** 지금 지도에서 보고 있는 곳(가운데)을 기준으로 검색 */
  const searchHere = (at) => {
    if (!at) return;
    centerRef.current = { lat: at.lat, lng: at.lng };
    setCenter({ lat: at.lat, lng: at.lng, label: '보고 있는 지역', source: '보고 있는 지역' });
    runSearch(++runRef.current, at, kindRef.current);
  };

  /** 분류를 바꾼다 — 기준점이 이미 있으면 같은 곳에서 다시 검색만 한다 (아직 검색 전이면 이 분류로 첫 검색) */
  const pickKind = (id) => {
    if (id === kindRef.current && searched) return;
    kindRef.current = id;
    setKind(id);
    setSelectedId(null);
    const at = centerRef.current;
    if (!at) {
      load();
      return;
    }
    runSearch(++runRef.current, at, id);
  };

  const distanceText = (m) => (m == null ? '' : m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

  const kindChips = (
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
  );

  // 임베드(지도 탭): 목록이 지도 위 바텀시트로 올라오고, 분류 칩은 지도 위쪽에 떠 있다
  const { mode, toggleList, onSnapMode } = useMapExpand(navigation);
  const [frameHeight, setFrameHeight] = useState(0);
  const snaps = computeSnaps(frameHeight || 640, 0);
  const covered = mode === 'peek' ? snaps.peek : mode === 'full' ? snaps.full : snaps.half;

  const listBody = (
    <>
      {embed ? null : kindChips}
      {center ? (
        <Text style={type.meta}>
          기준: {center.source} · 가까운 순 · 약 1.2km
        </Text>
      ) : null}
      {!searched ? (
        <>
          <Text style={type.meta}>분류를 고르거나 아래 버튼을 누르면 현재 위치 주변을 찾아요.</Text>
          <Button label={`내 주변 ${kindInfo.label} 찾기`} onPress={load} />
        </>
      ) : loading ? (
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
      <View style={styles.embedRoot} onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
        <View style={StyleSheet.absoluteFill}>
          {center ? (
            <ExploreMap
              places={items}
              center={center}
              inset={covered}
              onSearchHere={searchHere}
              selectedId={selectedId}
              onSelectPlace={(place) => {
                setSelectedId(place.id);
                navigatePlaceInfo(navigation, place);
              }}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              {loading ? <ActivityIndicator color={colors.accent} /> : <Text style={type.meta}>주변을 찾으면 지도에 표시돼요</Text>}
            </View>
          )}
        </View>
        <View style={styles.chipsFloat} pointerEvents="box-none">
          {kindChips}
        </View>
        <MapSheet
          title={`주변 ${kindInfo.label}`}
          peekText={!searched ? '분류를 고르면 주변을 찾아요' : loading ? '검색 중…' : `${items.length}곳 · 가까운 순`}
          hideNav
          mode={mode}
          frameHeight={frameHeight}
          onToggle={toggleList}
          onSnapMode={onSnapMode}
        >
          <View style={styles.sheetBody}>{listBody}</View>
        </MapSheet>
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
  // 위쪽 가운데의 지도/주변 탐색 메뉴 뱃지 아래에 둔다
  chipsFloat: { position: 'absolute', top: 76, left: space.md, right: space.md },
  sheetBody: { gap: space.md },
  mapPlaceholder: {
    flex: 1,
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
