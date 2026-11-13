import { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../layout';
import { colors, space } from '../theme';

/** 허브 공통 헤더 — 언더라인 탭만 표시 (하단 탭바가 현재 메뉴를 알려 줌) */
export function HubShell({ tabs, value, onChange, children, fill }) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  // 세부 탭 사이를 좌우로 밀어 이동 (하단 메뉴는 밀어서 이동하지 않음)
  const live = useRef({});
  live.current = { tabs, value, onChange };
  const enter = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const prevIndex = useRef(tabs.findIndex((t) => t.id === value));
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === value);
    const prev = prevIndex.current;
    prevIndex.current = idx;
    if (prev === idx || prev < 0 || idx < 0) return undefined;
    tx.setValue((idx > prev ? 1 : -1) * 48);
    enter.setValue(0);
    const anim = Animated.parallel([
      Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tx, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]);
    anim.start();
    return () => anim.stop();
  }, [value]);
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 60 && Math.abs(g.vx) < 0.5) return;
        const { tabs: list, value: cur, onChange: change } = live.current;
        const i = list.findIndex((t) => t.id === cur);
        const to = g.dx < 0 ? i + 1 : i - 1;
        if (i >= 0 && to >= 0 && to < list.length) change(list[to].id);
      }
    })
  ).current;
  const headFrame =
    layout.width > layout.contentMaxWidth
      ? { maxWidth: layout.contentMaxWidth, width: '100%', alignSelf: 'center' }
      : null;
  return (
    <View style={[styles.root, fill && styles.fill]}>
      <View style={[styles.head, headFrame, { paddingTop: Math.max(insets.top, space.md) + space.md, paddingHorizontal: layout.gutter }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
          {tabs.map((option) => {
            const on = option.id === value;
            return (
              <Pressable
                key={option.id}
                onPress={() => onChange(option.id)}
                style={styles.tab}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{option.label}</Text>
                <View style={[styles.bar, on && styles.barOn]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={[styles.body, fill && styles.fill]}>
        <Animated.View
          style={[styles.content, fill && styles.fill, { opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ translateX: tx }] }]}
          {...swipe.panHandlers}
        >
          {children}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  head: { gap: 2, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabScroll: { flexGrow: 0 },
  tabRow: { gap: space.xl },
  tab: { paddingTop: space.sm },
  tabLabel: { fontSize: 16, fontWeight: '600', color: colors.faint, paddingBottom: space.sm },
  tabLabelOn: { color: colors.ink, fontWeight: '800' },
  bar: { height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  barOn: { backgroundColor: colors.accent },
  body: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0 }
});
