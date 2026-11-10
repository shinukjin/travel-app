import { useCallback, useEffect, useState } from 'react';
import { MapSelectionBar } from '../components/MapSelectionBar';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MapSheet from '../components/MapSheet';
import GoogleMap from '../components/GoogleMap.web';
import { useMapExpand } from '../hooks/useMapExpand';
import { colors } from '../theme';
import { Icon } from '../ui';
import { navigatePlaceInfo } from '../placeInfo';
import { loadGuideCache } from '../sync';

export default function MapScreen() {
  const navigation = useNavigation();
  const { mode, setMapMode, toggleList, onSnapMode } = useMapExpand(navigation);
  const [days, setDays] = useState([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
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

  return (
    <View style={styles.page} onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
      <GoogleMap
        markers={markers}
        fitKey={`${day?.id || 'none'}:${fitNonce}`}
        onRecenterRequest={() => setFitNonce((value) => value + 1)}
        selectedId={selected?.id}
        onMarkerPress={(item) => setSelected(item)}
      />
      <MapSelectionBar
        item={selected}
        onClose={() => setSelected(null)}
        onInfo={(item) => {
          setSelected(null);
          navigatePlaceInfo(navigation, item.place, item.note);
        }}
      />
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
        mode={mode}
        frameHeight={frameHeight}
        onToggle={toggleList}
        onSnapMode={onSnapMode}
        onPrev={() => setDayIndex((value) => value - 1)}
        onNext={() => setDayIndex((value) => value + 1)}
        onOpenPlace={(item) => navigatePlaceInfo(navigation, item.place, item.note)}
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
