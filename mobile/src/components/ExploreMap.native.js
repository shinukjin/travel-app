import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '../theme';
import { Icon } from '../ui';

export default function ExploreMap({ center, places, selectedId, onSelectPlace, compact, inset = 0, onSearchHere }) {
  const mapRef = useRef(null);
  const regionRef = useRef(null); // 지금 보고 있는 지도 영역
  const frameRef = useRef(640);
  const markers = useMemo(
    () => places.map((place) => ({ id: place.id, place })),
    [places]
  );

  useEffect(() => {
    if (!mapRef.current || !center) return;
    const coords = markers.map((m) => ({ latitude: m.place.lat, longitude: m.place.lng }));
    if (center.lat != null) coords.push({ latitude: center.lat, longitude: center.lng });
    if (!coords.length) return;
    if (coords.length === 1) {
      // 점이 하나뿐이면(검색 전) 적당한 배율로 보여 주고, 시트가 가린 만큼 위로 올려 가운데에 둔다
      const delta = 0.03;
      mapRef.current.animateToRegion(
        { latitude: coords[0].latitude - delta * (inset / 640) * 0.5, longitude: coords[0].longitude, latitudeDelta: delta, longitudeDelta: delta },
        350
      );
      return;
    }
    mapRef.current.fitToCoordinates(coords, {
      // 아래 목록(바텀시트)이 가린 만큼 비워 두고, 위쪽은 분류 칩 자리를 둔다
      edgePadding: { top: inset ? 128 : 48, right: 48, bottom: 48 + inset, left: 48 },
      animated: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, markers, places.length]);

  const region = center
    ? {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04
      }
    : undefined;

  // 보고 있는 곳(바텀시트에 가리지 않은 부분)의 가운데 좌표로 주변 검색을 요청한다
  const searchHere = () => {
    const r = regionRef.current;
    if (!r) return;
    const frame = frameRef.current || 640;
    onSearchHere?.({
      lat: r.latitude + r.latitudeDelta * (inset / 2 / frame),
      lng: r.longitude
    });
  };

  return (
    <View
      style={[styles.host, compact && styles.compact]}
      onLayout={(event) => {
        frameRef.current = event.nativeEvent.layout.height;
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
        }}
      >
        {center ? (
          <Marker
            coordinate={{ latitude: center.lat, longitude: center.lng }}
            pinColor={colors.forest}
            title={center.label || '기준'}
          />
        ) : null}
        {markers.map((item, index) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.place.lat, longitude: item.place.lng }}
            title={item.place.name}
            pinColor={selectedId === item.id ? colors.ink : undefined}
            onPress={() => onSelectPlace?.(item.place)}
          >
            {/* index label via title */}
          </Marker>
        ))}
      </MapView>
      {onSearchHere ? (
        <Pressable
          style={({ pressed }) => [styles.hereBtn, { top: inset ? 128 : 16 }, pressed && styles.herePressed]}
          onPress={searchHere}
          accessibilityRole="button"
          accessibilityLabel="이 지역 주변 검색"
        >
          <Icon name="locate" size={18} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 200, backgroundColor: colors.map },
  compact: { flex: 0, height: 220 },
  map: { flex: 1 },
  hereBtn: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  herePressed: { transform: [{ scale: 0.92 }], backgroundColor: colors.accentSoft }
});
