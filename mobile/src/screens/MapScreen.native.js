import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapSelectionBar } from '../components/MapSelectionBar';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapSheet from '../components/MapSheet';
import { useMapExpand } from '../hooks/useMapExpand';
import { colors } from '../theme';
import { Icon } from '../ui';
import { navigatePlaceInfo } from '../placeInfo';
import { loadGuideCache } from '../sync';

export default function MapScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const controlTop = Math.max(insets.top, 8) + 8;
  const { mode, setMapMode, toggleList, onSnapMode } = useMapExpand(navigation);
  const mapRef = useRef(null);
  const [days, setDays] = useState([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [here, setHere] = useState(null);
  const [frameHeight, setFrameHeight] = useState(0);
  const [selected, setSelected] = useState(null);
  const mapFirst = mode === 'peek';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const cache = await loadGuideCache();
        const today = new Date().toISOString().slice(0, 10);
        const allDays = cache.trips.flatMap((trip) => cache.schedules[trip.id] || []);
        if (active) {
          setDays(allDays);
          const idx = allDays.findIndex((day) => day.date === today);
          setDayIndex(idx >= 0 ? idx : 0);
        }
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          if (active) setHere(pos.coords);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const day = days[dayIndex];
  const markers = (day?.items || []).filter((item) => item.place?.lat && item.place?.lng);

  useEffect(() => {
    setSelected(null);
  }, [day?.id]);

  const region = useMemo(() => {
    if (markers.length) {
      const lats = markers.map((item) => item.place.lat);
      const lngs = markers.map((item) => item.place.lng);
      const latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
      const longitude = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const latitudeDelta = Math.max(Math.max(...lats) - Math.min(...lats), 0.01) * 1.8;
      const longitudeDelta = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.01) * 1.8;
      return { latitude, longitude, latitudeDelta, longitudeDelta };
    }
    if (here) {
      return { latitude: here.latitude, longitude: here.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    return { latitude: 41.387, longitude: 2.168, latitudeDelta: 0.04, longitudeDelta: 0.04 };
  }, [markers, here]);

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 350);
  }, [day?.id]);

  return (
    <View style={styles.page} onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        zoomControlEnabled
      >
        {markers.map((item, index) => (
          <Marker
            key={item.id}
            identifier={String(item.id)}
            coordinate={{ latitude: item.place.lat, longitude: item.place.lng }}
            title={`${index + 1}. ${item.place.name}`}
            description={item.note || item.place.address}
            pinColor={selected?.id === item.id ? '#0F172A' : undefined}
            onPress={() => setSelected(item)}
          />
        ))}
      </MapView>
      <MapSelectionBar
        item={selected}
        onClose={() => setSelected(null)}
        onInfo={(item) => {
          setSelected(null);
          navigatePlaceInfo(navigation, item.place, item.note);
        }}
      />
      <Pressable
        style={[styles.locate, { top: controlTop }]}
        onPress={() => mapRef.current?.animateToRegion(region, 350)}
        accessibilityRole="button"
        accessibilityLabel="일정 위치로"
      >
        <Icon name="locate" size={16} color={colors.ink} />
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
        mode={mode}
        frameHeight={frameHeight}
        onToggle={toggleList}
        onSnapMode={onSnapMode}
        onPrev={() => setDayIndex((v) => v - 1)}
        onNext={() => setDayIndex((v) => v + 1)}
        onOpenPlace={(item) => navigatePlaceInfo(navigation, item.place, item.note)}
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
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4
  },
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
