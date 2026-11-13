import { useEffect, useState } from 'react';
import { MapEmptyHint } from '../components/MapEmptyHint';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGuide } from '../GuideContext';
import MapSheet from '../components/MapSheet';
import { computeSnaps } from '../components/mapSheetSnap';
import GoogleMap from '../components/GoogleMap.web';
import { useMapExpand } from '../hooks/useMapExpand';
import { colors } from '../theme';
import { Icon } from '../ui';

export default function MapScreen() {
  const navigation = useNavigation();
  const { mode, setMapMode, toggleList, onSnapMode } = useMapExpand(navigation);
  // 홈에서 선택한 여행의 일정만 보여 준다
  const { days, tripId } = useGuide();
  const [dayIndex, setDayIndex] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [frameHeight, setFrameHeight] = useState(0);
  const [selected, setSelected] = useState(null);
  const mapFirst = mode === 'peek';

  // 여행이 바뀌면 오늘 날짜(없으면 1일차)로 맞춘다
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.date === today);
    setDayIndex(idx >= 0 ? idx : 0);
  }, [tripId]);

  // 내 위치(GPS) — 브라우저 위치 권한을 허용하면 파란 점으로 표시
  const [me, setMe] = useState(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  const [focus, setFocus] = useState(null);
  // 하단 목록이 지금 가리고 있는 높이 — 지도 가운데를 "보이는 영역" 기준으로 잡는 데 쓴다
  const snaps = computeSnaps(frameHeight || 640, 0);
  const covered = mode === 'peek' ? snaps.peek : mode === 'full' ? snaps.full : snaps.half;
  const focusItem = (item) => {
    // 일정지도에서는 장소 상세정보를 열지 않는다
    if (item.place?.lat == null || item.place?.lng == null) return;
    setSelected(item);
    setFocus({ lat: item.place.lat, lng: item.place.lng, inset: covered, nonce: Date.now() });
  };

  const day = days[dayIndex];
  const markers = (day?.items || []).filter((item) => item.place?.lat && item.place?.lng);

  useEffect(() => {
    setSelected(null);
  }, [day?.id]);

  return (
    <View style={styles.page} onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
      <GoogleMap
        markers={markers}
        fitKey={`${day?.id || 'none'}:${fitNonce}`}
        onRecenterRequest={() => setFitNonce((value) => value + 1)}
        selectedId={selected?.id}
        onMarkerPress={(item) => setSelected(item)}
        me={me}
        focus={focus}
        inset={covered}
      />
      {!markers.length ? <MapEmptyHint key={day?.id || 'none'} noSchedule={!days.length} /> : null}
      <Pressable
        style={styles.fab}
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
        onPrev={() => setDayIndex((value) => value - 1)}
        onNext={() => setDayIndex((value) => value + 1)}
        onOpenPlace={focusItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.map },
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
    shadowOffset: { width: 0, height: 4 }
  }
});
