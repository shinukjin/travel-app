import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGuide } from '../GuideContext';
import ExploreMap from '../components/ExploreMap';
import { fetchNearbyAttractions, navigatePlaceInfo } from '../placeInfo';
import { colors, radius, shadow, space, type } from '../theme';
import { Button, Icon, Surface } from '../ui';

function firstPlannedCoords(days) {
  for (const day of days || []) {
    const item = (day.items || []).find((row) => row.place?.lat != null && row.place?.lng != null);
    if (item) return { lat: item.place.lat, lng: item.place.lng, label: item.place.name };
  }
  return null;
}

export default function NearbyScreen({ embed }) {
  const navigation = useNavigation();
  const { days, nextStop } = useGuide();
  const [center, setCenter] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let lat;
      let lng;
      let source = '일정';
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          source = '현재 위치';
        } catch {
          /* fall through */
        }
      }
      if (lat == null && nextStop?.place?.lat != null) {
        lat = nextStop.place.lat;
        lng = nextStop.place.lng;
        source = '다음 일정';
      }
      if (lat == null) {
        const planned = firstPlannedCoords(days);
        if (planned) {
          lat = planned.lat;
          lng = planned.lng;
          source = planned.label || '일정';
        }
      }
      if (lat == null) {
        setError('위치를 알 수 없어요. 일정에 장소를 추가하거나 위치 권한을 허용해 주세요.');
        setItems([]);
        setCenter(null);
        return;
      }
      setCenter({ lat, lng, label: source, source });
      const list = await fetchNearbyAttractions(lat, lng);
      setItems(list);
      setSelectedId(null);
    } catch (e) {
      setError(e.message || '주변 검색에 실패했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [days, nextStop]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const listBody = (
    <>
      {center ? (
        <Text style={type.meta}>
          기준: {center.source} · Google Places (약 1.2km)
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
                  <Icon name="compass" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {place.memo || place.address ? (
                    <Text style={type.meta} numberOfLines={1}>
                      {place.memo || place.address}
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
          <Text style={type.meta}>근처에 표시할 관광지가 없습니다.</Text>
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
  error: { ...type.body, color: colors.forest },
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
