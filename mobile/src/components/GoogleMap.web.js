import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { getGoogleMapsApiKey } from '../mapsConfig';
import { loadGoogleMapsApi } from '../maps/googleMapsLoader.web';
import { colors } from '../theme';
import { Icon } from '../ui';

function fitMarkers(map, markers, maps, center) {
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
    return;
  }
  map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
}

export default function GoogleMap({
  markers,
  fitKey,
  onRecenterRequest,
  onMarkerPress,
  selectedId,
  center,
  compact
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerHandles = useRef([]);
  const centerMarkerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    fitMarkers(map, markers, window.google.maps, center);
    onRecenterRequest?.();
  }, [markers, center, onRecenterRequest]);

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
    fitMarkers(mapRef.current, markers, maps, center);
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
      const marker = new maps.Marker({
        map,
        position: { lat: item.place.lat, lng: item.place.lng },
        title: item.place?.name,
        label: { text: String(index + 1), color: '#ffffff', fontWeight: '700' },
        zIndex: selected ? 10 : 1,
        icon: selected
          ? {
              path: maps.SymbolPath.CIRCLE,
              fillColor: colors.ink,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 14
            }
          : {
              path: maps.SymbolPath.CIRCLE,
              fillColor: colors.accent,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 12
            }
      });
      marker.addListener('click', () => onMarkerPress?.(item));
      markerHandles.current.push(marker);
    });

    fitMarkers(map, markers, maps, center);
  }, [markers, fitKey, selectedId, center, ready, onMarkerPress]);

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
        <Pressable
          style={styles.zoomBtn}
          onPress={fit}
          accessibilityRole="button"
          accessibilityLabel="일정 위치로"
        >
          <Icon name="locate" size={16} color={colors.ink} />
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
  zoom: { position: 'absolute', left: 12, top: 16 },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  }
});
