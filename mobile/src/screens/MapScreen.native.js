import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapSheet from '../components/MapSheet';
import { useMapExpand } from '../hooks/useMapExpand';
import { colors } from '../theme';
import { Icon } from '../ui';
import { useGuide } from '../GuideContext';
import { MapEmptyHint } from '../components/MapEmptyHint';
import { computeSnaps } from '../components/mapSheetSnap';
import { Text } from '../Text';

const PIN_RED = '#E5484D';

/** 가늘고 작은 원형 핀 — 흰 테두리로 지도 위에서도 또렷하게 보인다 */
function PinMarker({ id, coordinate, no, active, onPress }) {
  // 커스텀 뷰는 처음 그릴 때만 비트맵으로 만들면 되므로, 잠깐 켰다가 끈다 (성능)
  const [track, setTrack] = useState(true);
  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), 600);
    return () => clearTimeout(t);
  }, [active, no]);
  return (
    <Marker
      identifier={id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.97 }}
      tracksViewChanges={track}
      zIndex={active ? 10 : 1}
      onPress={onPress}
    >
      <View style={active ? styles.pinBoxActive : styles.pinBox}>
        {/* 물방울 모양: 둥근 사각형의 한쪽 모서리만 뾰족하게 두고 45도 돌린다 */}
        <View style={[styles.pin, active && styles.pinActive]}>
          <Text style={[styles.pinText, active && styles.pinTextActive]}>{no}</Text>
        </View>
      </View>
    </Marker>
  );
}

export default function MapScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const controlTop = Math.max(insets.top, 8) + 8;
  const { mode, setMapMode, toggleList, onSnapMode } = useMapExpand(navigation);
  const mapRef = useRef(null);
  // 홈에서 선택한 여행의 일정만 보여 준다
  const { days, tripId } = useGuide();
  const [dayIndex, setDayIndex] = useState(0);
  const [here, setHere] = useState(null);
  const [frameHeight, setFrameHeight] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [selected, setSelected] = useState(null);
  // 목록에서 고른 장소(지도 가운데로 이동 + 핀 강조). 정보 카드는 핀을 눌렀을 때만 뜬다
  const [focused, setFocused] = useState(null);
  const [atHere, setAtHere] = useState(false);
  const mapFirst = mode === 'peek';

  // 여행이 바뀌면 오늘 날짜(없으면 1일차)로 맞춘다
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.date === today);
    setDayIndex(idx >= 0 ? idx : 0);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let sub = null;
      (async () => {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status !== 'granted') return;
          // 마지막 위치로 먼저 빠르게 이동하고, 이어서 현재 위치를 계속 따라가며 갱신한다
          const last = await Location.getLastKnownPositionAsync();
          if (active && last) setHere(last.coords);
          const watcher = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
            (pos) => {
              if (active) setHere(pos.coords);
            }
          );
          if (active) sub = watcher;
          else watcher.remove();
        } catch {
          /* 위치를 못 가져와도 일정 기준으로 동작 */
        }
      })();
      return () => {
        active = false;
        sub?.remove();
      };
    }, [])
  );

  const day = days[dayIndex];
  const markers = (day?.items || []).filter((item) => item.place?.lat && item.place?.lng);

  useEffect(() => {
    setSelected(null);
    setFocused(null);
  }, [day?.id]);

  /**
   * 목록(하단 패널)이 지금 차지한 높이를 뺀, "실제로 보이는 지도"의 가운데에 오도록 영역을 옮긴다.
   * fit=true 이면 영역 전체가 보이는 부분에 들어가도록 범위도 넓힌다.
   */
  const visibleRegion = (region, fit = false) => {
    const frame = frameHeight || 640;
    const width = frameWidth || 360;
    const snaps = computeSnaps(frame, 0);
    const covered = mode === 'peek' ? snaps.peek : mode === 'full' ? snaps.full : snaps.half;
    const visibleRatio = Math.max((frame - covered) / frame, 0.25);
    // 지도는 가로·세로 중 더 많이 필요한 쪽에 맞춰 확대된다. 세로로 긴 화면에서는 보통 가로가 기준이라
    // latitudeDelta 만으로 계산하면 실제 보이는 세로 범위가 달라져 중앙이 어긋난다 → 실제 범위로 맞춘다
    const lngToLat = (frame / width) * Math.cos((region.latitude * Math.PI) / 180);
    const needLat = fit ? region.latitudeDelta / visibleRatio : region.latitudeDelta;
    const span = Math.max(needLat, region.longitudeDelta * lngToLat);
    const shift = (covered / frame) * span * 0.5;
    return {
      latitude: region.latitude - shift,
      longitude: region.longitude,
      latitudeDelta: span,
      longitudeDelta: span / lngToLat
    };
  };

  /** 목록에서 장소를 고르면 그 위치를 (패널에 가리지 않는) 보이는 지도의 가운데로 옮긴다 */
  const focusItem = (item) => {
    // 일정지도에서는 장소 상세정보를 열지 않는다 — 위치가 없는 장소는 이동할 곳이 없다
    if (item.place?.lat == null || item.place?.lng == null) return;
    setFocused(item);
    setAtHere(false);
    mapRef.current?.animateToRegion(
      visibleRegion({ latitude: item.place.lat, longitude: item.place.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }),
      400
    );
  };

  /** 선택한 날 일정 마커가 모두 보이는 영역 (일정이 없으면 null) */
  const scheduleRegion = useMemo(() => {
    if (!markers.length) return null;
    const lats = markers.map((item) => item.place.lat);
    const lngs = markers.map((item) => item.place.lng);
    const latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
    const longitude = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    // 장소가 한두 개여도 너무 가까이 확대되지 않게 최소 범위(약 3km)를 둔다
    const latitudeDelta = Math.max(Math.max(...lats) - Math.min(...lats), 0.03) * 1.8;
    const longitudeDelta = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.03) * 1.8;
    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }, [markers]);

  const hereRegion = here
    ? { latitude: here.latitude, longitude: here.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : null;

  // 기본 시점은 내 위치. 위치를 못 얻으면 일정 영역, 그것도 없으면 어느 나라든 어색하지 않게 세계 지도
  const initialRegion = hereRegion || scheduleRegion || { latitude: 25, longitude: 20, latitudeDelta: 110, longitudeDelta: 110 };

  // 처음 위치를 얻었을 때 한 번만 내 위치로 이동 (이후 사용자가 지도를 움직이면 건드리지 않음)
  const centeredOnHere = useRef(false);
  useEffect(() => {
    if (hereRegion && !centeredOnHere.current) {
      centeredOnHere.current = true;
      mapRef.current?.animateToRegion(visibleRegion(hereRegion), 350);
    }
  }, [here]);

  // 사용자가 날짜를 바꿀 때만 그 날 일정 영역으로 이동
  const dayChangedByUser = useRef(false);
  useEffect(() => {
    if (dayChangedByUser.current && scheduleRegion) {
      mapRef.current?.animateToRegion(visibleRegion(scheduleRegion, true), 350);
    }
  }, [day?.id]);

  // 누른 걸 알 수 있게 버튼 색을 잠깐 바꿨다가 원래대로 돌린다
  const flashTimer = useRef(null);
  const flashHere = () => {
    setAtHere(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setAtHere(false), 1200);
  };
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const goHere = async () => {
    if (hereRegion) {
      flashHere();
      mapRef.current?.animateToRegion(visibleRegion(hereRegion), 350);
      return;
    }
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('위치 권한이 필요해요', '설정에서 위치 권한을 허용해 주세요.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setHere(pos.coords);
      flashHere();
      mapRef.current?.animateToRegion(
        visibleRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }),
        350
      );
    } catch {
      Alert.alert('현재 위치를 가져오지 못했어요', 'GPS가 켜져 있는지 확인해 주세요.');
    }
  };

  const goSchedule = () => {
    setAtHere(false);
    if (scheduleRegion) mapRef.current?.animateToRegion(visibleRegion(scheduleRegion, true), 350);
    else Alert.alert('표시할 일정이 없어요', '이 날짜에는 좌표가 있는 장소가 없어요.');
  };

  return (
    <View style={styles.page} onLayout={(event) => {
        setFrameHeight(event.nativeEvent.layout.height);
        setFrameWidth(event.nativeEvent.layout.width);
      }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        zoomControlEnabled
        onPanDrag={() => atHere && setAtHere(false)}
      >
        {markers.map((item, index) => (
          <PinMarker
            key={item.id}
            id={String(item.id)}
            coordinate={{ latitude: item.place.lat, longitude: item.place.lng }}
            no={index + 1}
            active={focused?.id === item.id}
            onPress={() => setFocused(item)}
          />
        ))}
      </MapView>
      {!markers.length ? <MapEmptyHint key={day?.id || 'none'} noSchedule={!days.length} /> : null}
      <Pressable
        style={({ pressed }) => [styles.locate, { top: controlTop }, atHere && styles.locateOn, pressed && styles.pressed]}
        onPress={goHere}
        android_ripple={{ color: colors.accentGlow, borderless: false }}
        accessibilityRole="button"
        accessibilityState={{ selected: atHere }}
        accessibilityLabel="내 위치로"
      >
        <Icon name="locate" size={18} color={atHere ? 'white' : colors.ink} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.locate, { top: controlTop + 48 }, pressed && styles.pressed]}
        onPress={goSchedule}
        android_ripple={{ color: colors.accentGlow, borderless: false }}
        accessibilityRole="button"
        accessibilityLabel="일정 위치로"
      >
        <Icon name="calendar-outline" size={16} color={colors.ink} />
      </Pressable>
      <Pressable
        style={[styles.fab, { top: controlTop }]}
        onPress={() => setMapMode(mapFirst ? 'half' : 'peek')}
        accessibilityRole="button"
        accessibilityLabel={mapFirst ? '목록' : '전체 지도'}
      >
        <Icon name={mapFirst ? 'list' : 'expand'} size={18} color={colors.ink} />
      </Pressable>
      <MapSheet
        day={day}
        days={days}
        dayIndex={dayIndex}
        markers={markers}
        items={day?.items || []}
        mode={mode}
        frameHeight={frameHeight}
        onToggle={toggleList}
        onSnapMode={onSnapMode}
        onPrev={() => {
          dayChangedByUser.current = true;
          setDayIndex((v) => v - 1);
        }}
        onNext={() => {
          dayChangedByUser.current = true;
          setDayIndex((v) => v + 1);
        }}
        onOpenPlace={focusItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  locate: {
    position: 'absolute',
    left: 12,
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4
  },
  locateOn: { backgroundColor: colors.accent },
  pressed: { transform: [{ scale: 0.92 }], backgroundColor: colors.accentSoft },
  pinBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pinBoxActive: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderBottomRightRadius: 0,
    backgroundColor: PIN_RED,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    elevation: 3
  },
  pinActive: { width: 38, height: 38, borderRadius: 19, borderBottomRightRadius: 0 },
  pinText: { color: 'white', fontSize: 14, fontWeight: '800', includeFontPadding: false, transform: [{ rotate: '-45deg' }] },
  pinTextActive: { fontSize: 16 },
  fab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  }
});
