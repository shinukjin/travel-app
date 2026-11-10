import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '../theme';

export default function ExploreMap({ center, places, selectedId, onSelectPlace, compact }) {
  const mapRef = useRef(null);
  const markers = useMemo(
    () => places.map((place) => ({ id: place.id, place })),
    [places]
  );

  useEffect(() => {
    if (!mapRef.current || !center) return;
    const coords = markers.map((m) => ({ latitude: m.place.lat, longitude: m.place.lng }));
    if (center.lat != null) coords.push({ latitude: center.lat, longitude: center.lng });
    if (!coords.length) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true
    });
  }, [center, markers, places.length]);

  const region = center
    ? {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04
      }
    : undefined;

  return (
    <View style={[styles.host, compact && styles.compact]}>
      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={region} showsUserLocation>
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
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 200, backgroundColor: colors.map },
  compact: { flex: 0, height: 220 },
  map: { flex: 1 }
});
