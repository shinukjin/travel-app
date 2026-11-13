import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, formatTime, space } from '../theme';
import { Icon, TravelLeg } from '../ui';

/**
 * 그날의 일정 목록. items(전체)를 주면 좌표 없는 장소도 보여 주고 "위치 없음"으로 표시한다.
 * 지도 핀 번호는 좌표가 있는 장소끼리만 매긴다.
 */
export function MapStopList({ markers, items, onOpenPlace }) {
  const list = items || markers || [];
  const hasPos = (it) => it.place?.lat != null && it.place?.lng != null;
  let pinNo = 0;
  return list.map((item, index) => {
    const located = hasPos(item);
    if (located) pinNo += 1;
    const prev = index > 0 ? list[index - 1] : null;
    return (
      <View key={item.id}>
        {prev && hasPos(prev) && located ? <TravelLeg from={prev.place} to={item.place} /> : null}
        <View style={styles.row}>
          <Pressable
            style={styles.main}
            onPress={() => onOpenPlace?.(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.place?.name || '장소'} 정보${located ? '' : ', 위치 없음'}`}
          >
            <View style={[styles.pin, !located && styles.pinOff]}>
              <Text style={styles.pinText}>{located ? pinNo : '–'}</Text>
            </View>
            <Text style={styles.timeCol}>{formatTime(item.startTime)}</Text>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {item.place?.name}
              </Text>
              {!located ? (
                <Text style={styles.metaWarn} numberOfLines={1}>
                  위치 없음 · 지도에 표시되지 않아요
                </Text>
              ) : item.place?.address ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {item.place.address}
                </Text>
              ) : null}
            </View>
          </Pressable>
          {located ? (
            <Pressable
              style={styles.go}
              onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.place.lat},${item.place.lng}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.place?.name || '장소'} 길찾기`}
            >
              <Icon name="navigate" size={14} color="white" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  });
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
  pinOff: { backgroundColor: colors.faint },
  pinText: { color: 'white', fontSize: 12, fontWeight: '800' },
  metaWarn: { color: colors.danger, fontSize: 12, marginTop: 2, fontWeight: '600' },
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
