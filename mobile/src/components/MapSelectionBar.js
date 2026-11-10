import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, formatTime, radius, shadow, space, type } from '../theme';
import { Icon } from '../ui';

/** MapHubMenuBadge 아래에 선택 정보 카드가 오도록 */
const BADGE_CLEARANCE = 52;

export function openDirections(place) {
  if (place?.lat == null || place?.lng == null) return;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`);
}

export function MapSelectionBar({ item, onClose, onInfo }) {
  const insets = useSafeAreaInsets();
  if (!item?.place) return null;
  const place = item.place;
  const top = Math.max(insets.top, space.sm) + BADGE_CLEARANCE;

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={styles.card}>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
        <Text style={styles.time}>{formatTime(item.startTime)}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {place.name}
        </Text>
        {place.address ? (
          <Text style={type.meta} numberOfLines={2}>
            {place.address}
          </Text>
        ) : null}
        {item.note ? (
          <Text style={styles.note} numberOfLines={2}>
            {item.note}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => onInfo?.(item)} accessibilityRole="button" accessibilityLabel="장소 정보">
            <Icon name="information-circle" size={18} color="white" />
            <Text style={styles.primaryText}>정보</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => openDirections(place)}
            accessibilityRole="button"
            accessibilityLabel="길찾기"
          >
            <Icon name="navigate" size={18} color={colors.accent} />
            <Text style={styles.secondaryText}>길찾기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    zIndex: 20
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.sheet,
    padding: space.lg,
    paddingTop: space.md,
    gap: 4,
    ...shadow.float
  },
  close: {
    position: 'absolute',
    right: space.sm,
    top: space.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  time: { ...type.caption, color: colors.accent },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink, paddingRight: 28 },
  note: { ...type.body, fontSize: 14, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.pill
  },
  primaryText: { color: 'white', fontWeight: '800', fontSize: 15 },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingVertical: 12,
    borderRadius: radius.pill
  },
  secondaryText: { color: colors.accentDark, fontWeight: '800', fontSize: 15 }
});
