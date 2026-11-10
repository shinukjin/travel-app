import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '../theme';
import { Icon } from '../ui';

const SECTIONS = [
  { id: 'map', label: '일정 지도', icon: ['map-outline', 'map'] },
  { id: 'nearby', label: '주변 탐색', icon: ['compass-outline', 'compass'] }
];

/** 지도 허브 상단 전환 스위치 (일정 지도 / 주변 탐색). 앱 이동은 하단 탭바가 담당한다. */
export function MapHubMenuBadge({ section, onSectionChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.anchor, { top: Math.max(insets.top, space.sm) + 8 }]}
      pointerEvents="box-none"
    >
      <View style={styles.switch}>
        {SECTIONS.map((opt) => {
          const on = opt.id === section;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSectionChange?.(opt.id)}
              style={[styles.seg, on && styles.segOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={opt.label}
            >
              <Icon name={on ? opt.icon[1] : opt.icon[0]} size={16} color={on ? '#fff' : colors.muted} />
              <Text style={[styles.label, on && styles.labelOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 40, elevation: 40 },
  switch: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.float
  },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill
  },
  segOn: { backgroundColor: colors.navy },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  labelOn: { color: '#fff' }
});
