import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigateTool, toolLauncherItems } from '../tools';
import { TAB_BAR_BASE, TAB_BAR_FLOAT, colors, radius, shadow, space, type } from '../theme';
import { Icon } from '../ui';

function MenuRow({ item, onPress, last }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, last && styles.rowLast]}
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
    >
      <View style={[styles.rowIcon, { backgroundColor: item.tint }]}>
        <Icon name={item.icon} size={18} color={item.iconColor} />
      </View>
      <Text style={styles.rowLabel}>{item.label}</Text>
      <Icon name="chevron-forward" size={16} color={colors.faint} />
    </Pressable>
  );
}

export function MoreMenuOverlay({ visible, onClose }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabClearance = TAB_BAR_BASE + TAB_BAR_FLOAT + insets.bottom + 12;
  const [mounted, setMounted] = useState(false);

  const backdrop = useSharedValue(0);
  const slide = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdrop.value = withTiming(1, { duration: 200 });
      slide.value = withSpring(0, { damping: 22, stiffness: 280 });
      return;
    }
    backdrop.value = withTiming(0, { duration: 160 });
    slide.value = withTiming(1, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [visible, backdrop, slide]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.4
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value * 320 }],
    opacity: 1 - slide.value
  }));

  const items = toolLauncherItems({ inSettings: true });

  function pick(item) {
    onClose();
    setTimeout(() => navigateTool(navigation, item), 100);
  }

  if (!mounted) return null;

  return (
    <View style={[styles.host, { paddingBottom: tabClearance }]} pointerEvents={visible ? 'box-none' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="메뉴 닫기">
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'} />
      </Pressable>
      <Animated.View style={[styles.sheet, sheetStyle]} accessibilityRole="menu">
        <View style={styles.handle} />
        <Text style={styles.title}>메뉴</Text>
        <ScrollView style={styles.list} bounces={false} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <MenuRow
              key={item.key}
              item={item}
              onPress={() => pick(item)}
              last={index === items.length - 1}
            />
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
    paddingHorizontal: space.md
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ink
  },
  sheet: {
    maxHeight: '58%',
    backgroundColor: colors.card,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow.float
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginTop: space.sm,
    marginBottom: space.xs
  },
  title: {
    ...type.caption,
    textAlign: 'center',
    color: colors.muted,
    marginBottom: space.xs,
    paddingHorizontal: space.md
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineHair
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
});
