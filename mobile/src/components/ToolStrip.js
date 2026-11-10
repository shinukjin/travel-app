import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useLayout } from '../layout';
import { colors, radius, space } from '../theme';
import { Icon } from '../ui';

function ShortcutChip({ item, onPress, flex }) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.chip, flex && styles.chipFlex, pressed && styles.chipPressed]}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.tint || colors.accentSoft }]}>
        <Icon name={item.icon} size={20} color={item.iconColor || colors.accent} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label}>{item.label}</Text>
        {item.hint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {item.hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ToolStrip({ items, onPress }) {
  const layout = useLayout();

  if (layout.shortcutGrid) {
    const cols = Math.min(layout.gridColumns, items.length);
    const cellPct = `${100 / cols}%`;
    return (
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.key} style={[styles.gridCell, { width: cellPct }]}>
            <ShortcutChip item={item} onPress={onPress} flex />
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => (
        <ShortcutChip key={item.key} item={item} onPress={onPress} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.xs,
    paddingRight: space.md
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  gridCell: {
    paddingRight: space.md,
    marginBottom: space.md,
    minWidth: 150
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minWidth: 148,
    maxWidth: 240,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipFlex: { flex: 1, maxWidth: '100%' },
  chipPressed: { backgroundColor: colors.surfaceTint },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textCol: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 },
  hint: { fontSize: 11, fontWeight: '600', color: colors.muted }
});
