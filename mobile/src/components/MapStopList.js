import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, formatTime, space } from '../theme';
import { Icon, TravelLeg } from '../ui';

export function MapStopList({ markers, onOpenPlace }) {
  return markers.map((item, index) => (
    <View key={item.id}>
      {index > 0 ? <TravelLeg from={markers[index - 1].place} to={item.place} /> : null}
      <View style={styles.row}>
        <Pressable
          style={styles.main}
          onPress={() => onOpenPlace?.(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.place?.name || '장소'} 정보`}
        >
          <View style={styles.pin}>
            <Text style={styles.pinText}>{index + 1}</Text>
          </View>
          <Text style={styles.timeCol}>{formatTime(item.startTime)}</Text>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {item.place?.name}
            </Text>
            {item.place?.address ? (
              <Text style={styles.meta} numberOfLines={1}>
                {item.place.address}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          style={styles.go}
          onPress={() => {
            if (item.place?.lat == null || item.place?.lng == null) return;
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.place.lat},${item.place.lng}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${item.place?.name || '장소'} 길찾기`}
        >
          <Icon name="navigate" size={14} color="white" />
        </Pressable>
      </View>
    </View>
  ));
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pinText: { color: 'white', fontSize: 12, fontWeight: '800' },
  timeCol: { width: 44, fontSize: 13, fontWeight: '700', color: colors.accent },
  body: { flex: 1 },
  name: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  go: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
