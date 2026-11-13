import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { getGoogleMapsApiKey } from '../mapsConfig';
import { loadGoogleMapsApi } from '../maps/googleMapsLoader.web';
import { colors } from '../theme';
import { Icon } from '../ui';

function fitMarkers(map, markers, maps, center, inset = 0) {
  if (!map) return;
  const bounds = new maps.LatLngBounds();
  let hasPoint = false;
  if (center?.lat != null && center?.lng != null) {
    bounds.extend({ lat: center.lat, lng: center.lng });
    hasPoint = true;
  }
  markers.forEach((item) => {
    bounds.extend({ lat: item.place.lat, lng: item.place.lng });
    hasPoint = true;
  });
  if (!hasPoint) return;
  if (!markers.length && center) {
    map.setCenter({ lat: center.lat, lng: center.lng });
    map.setZoom(14);
    if (inset) map.panBy(0, inset / 2);
    return;
  }
  // 점이 하나뿐이면 fitBounds 가 여백을 무시하므로, 직접 가운데·확대를 잡고 패널만큼 올린다
  const samePoint =
    markers.length > 0 && markers.every((m) => m.place.lat === markers[0].place.lat && m.place.lng === markers[0].place.lng);
  if (samePoint && !center) {
    map.setCenter({ lat: markers[0].place.lat, lng: markers[0].place.lng });
    map.setZoom(14);
    if (inset) map.panBy(0, inset / 2);
    return;
  }
  // 하단 패널이 가린 만큼 아래 여백을 늘려, 보이는 지도 안에 모두 들어오게 한다
  map.fitBounds(bounds, { top: 56, right: 56, bottom: 56 + inset, left: 56 });
  // 마커가 한두 개면 fitBounds 가 건물 단위까지 확대한다 — 주변 거리가 보이도록 확대 한계를 둔다
  maps.event.addListenerOnce(map, 'idle', () => {
    if (map.getZoom() > 14) map.setZoom(14);
  });
}

export default function GoogleMap({
  markers,
  fitKey,
  onRecenterRequest,
  onScheduleRequest,
  onMarkerPress,
  selectedId,
  center,
  compact,
  me,
  focus,
  inset = 0
}) {
  const meHandles = useRef([]);
  const [atMe, setAtMe] = useState(false);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerHandles = useRef([]);
  const centerMarkerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    fitMarkers(map, markers, window.google.maps, center, inset);
    onRecenterRequest?.();
  }, [markers, center, onRecenterRequest, inset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = getGoogleMapsApiKey();
      if (!key) {
        setError('API 키 없음: 프로젝트 루트 .env에 google_maps_api_key를 넣고 앱을 다시 시작하세요.');
        return;
      }
      try {
        await loadGoogleMapsApi(key);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err.message || '지도 로드 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const maps = window.google.maps;
    mapRef.current = new maps.Map(containerRef.current, {
      center: { lat: 37.5665, lng: 126.978 },
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy'
    });
    fitMarkers(mapRef.current, markers, maps, center, inset);
  }, [ready, markers, center]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;

    markerHandles.current.forEach((m) => m.setMap(null));
    markerHandles.current = [];
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
      centerMarkerRef.current = null;
    }

    if (center?.lat != null && center?.lng != null) {
      centerMarkerRef.current = new maps.Marker({
        map,
        position: { lat: center.lat, lng: center.lng },
        title: center.label || '기준 위치',
        zIndex: 5,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: colors.forest,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 9
        }
      });
    }

    markers.forEach((item, index) => {
      const selected = selectedId === item.id;
      // 작고 가는 핀 + 흰 테두리 — 지도 위에서 또렷하게
      const marker = new maps.Marker({
        map,
        position: { lat: item.place.lat, lng: item.place.lng },
        title: item.place?.name,
        label: { text: String(index + 1), color: '#ffffff', fontWeight: '700', fontSize: '14px' },
        zIndex: selected ? 10 : 1,
        // 물방울 핀: 끝이 (0,0)에 닿는 모양, 번호는 둥근 부분 가운데에
        icon: {
          path: 'M0,0 C-3,-12 -14,-16 -14,-27 C-14,-35 -8,-41 0,-41 C8,-41 14,-35 14,-27 C14,-16 3,-12 0,0 Z',
          fillColor: '#E5484D',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: selected ? 1.25 : 1,
          labelOrigin: new maps.Point(0, -27)
        }
      });
      marker.addListener('click', () => onMarkerPress?.(item));
      markerHandles.current.push(marker);
    });
  }, [markers, selectedId, center, ready, onMarkerPress]);

  // 일정/기준 위치가 바뀔 때만 영역에 맞춘다 (선택·리렌더 때는 건드리지 않음)
  const markerKey = markers.map((m) => m.id).join(',');
  const centerKey = center ? `${center.lat},${center.lng}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    fitMarkers(map, markers, window.google.maps, center, inset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markerKey, centerKey, fitKey]);

  // 내 위치(GPS) — 파란 점 + 옅은 반경
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    meHandles.current.forEach((m) => m.setMap(null));
    meHandles.current = [];
    if (!map || !maps || !me) return;
    const dot = (scale, opacity, stroke) =>
      new maps.Marker({
        map,
        position: { lat: me.lat, lng: me.lng },
        title: '내 위치',
        clickable: false,
        zIndex: 6,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          fillColor: '#2F6FEB',
          fillOpacity: opacity,
          strokeColor: '#ffffff',
          strokeWeight: stroke,
          scale
        }
      });
    meHandles.current = [dot(18, 0.18, 0), dot(7, 1, 2)];
  }, [me?.lat, me?.lng, ready]);

  // 목록에서 고른 장소를 (패널에 가리지 않는) 보이는 지도의 가운데로
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    setAtMe(false);
    map.setCenter({ lat: focus.lat, lng: focus.lng });
    if ((map.getZoom() || 0) < 14) map.setZoom(14);
    if (focus.inset) map.panBy(0, focus.inset / 2);
  }, [focus?.nonce]);

  const goMe = () => {
    const map = mapRef.current;
    if (!map || !me) return;
    // 누른 걸 알 수 있게 버튼 색을 잠깐 바꿨다가 원래대로 돌린다
    setAtMe(true);
    setTimeout(() => setAtMe(false), 1200);
    // 패널에 가려진 만큼 위로 올려, 보이는 지도의 가운데에 내 위치가 오게 한다
    map.setCenter({ lat: me.lat, lng: me.lng });
    if ((map.getZoom() || 0) < 13) map.setZoom(13);
    if (inset) map.panBy(0, inset / 2);
  };

  if (error) {
    return (
      <View style={styles.host}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.host, compact && styles.hostCompact]}>
      <View ref={containerRef} style={styles.map} accessibilityRole="image" accessibilityLabel="Google 지도" />
      <View style={styles.zoom} pointerEvents="box-none">
        {me ? (
          <Pressable
            style={({ pressed }) => [styles.zoomBtn, atMe && styles.zoomOn, pressed && styles.zoomPressed]}
            onPress={goMe}
            accessibilityRole="button"
            accessibilityLabel="내 위치로"
          >
            <Icon name="locate" size={18} color={atMe ? 'white' : colors.ink} />
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.zoomBtn, pressed && styles.zoomPressed]}
          onPress={() => {
            setAtMe(false);
            // 일정 화면에서는 현재 시각의 일정 장소로, 그 외에는 전체 마커가 보이게
            if (onScheduleRequest) onScheduleRequest();
            else fit();
          }}
          accessibilityRole="button"
          accessibilityLabel="일정 위치로"
        >
          <Icon name="calendar-outline" size={18} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 200,
    backgroundColor: colors.map,
    overflow: 'hidden',
    position: 'relative'
  },
  hostCompact: { flex: 0, height: 220 },
  map: { flex: 1, width: '100%', height: '100%' },
  error: { flex: 1, padding: 24, textAlign: 'center', color: colors.muted, fontSize: 14 },
  zoom: { position: 'absolute', left: 12, top: 16, gap: 8 },
  zoomOn: { backgroundColor: colors.accent },
  zoomPressed: { transform: [{ scale: 0.92 }], backgroundColor: colors.accentSoft },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  }
});
