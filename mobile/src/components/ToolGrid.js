import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, radius, shadow, space } from '../theme';
import { Icon } from '../ui';

export function ToolGrid({ items, onPress }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          onPress={() => onPress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={[styles.iconWrap, { backgroundColor: item.tint || colors.accentSoft }]}>
            <Icon name={item.icon} size={24} color={item.iconColor || colors.accent} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md
  },
  tile: {
    width: '22.5%',
    minWidth: 74,
    flexGrow: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm
  },
  tilePressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card
  },
  label: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center', letterSpacing: -0.2 }
});
