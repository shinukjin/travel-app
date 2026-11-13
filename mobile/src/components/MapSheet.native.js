import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapStopList } from './MapStopList';
import { computeSnaps } from './mapSheetSnap';
import { colors, formatDay, formatTime, shadow, space } from '../theme';
import { Icon } from '../ui';

function snapModeWorklet(h, snaps) {
  'worklet';
  const dist = (target) => Math.abs(h - target);
  if (dist(snaps.peek) <= dist(snaps.half) && dist(snaps.peek) <= dist(snaps.full)) return 'peek';
  if (dist(snaps.half) <= dist(snaps.full)) return 'half';
  return 'full';
}

export default function MapSheet({
  day,
  days,
  dayIndex,
  onPrev,
  onNext,
  markers = [],
  items,
  mode,
  onSnapMode,
  onToggle,
  frameHeight,
  onOpenPlace,
  title,
  peekText,
  hideNav,
  children
}) {
  const insets = useSafeAreaInsets();
  const frame = frameHeight || 640;

  const snaps = useMemo(() => computeSnaps(frame, 0), [frame]);

  const height = useSharedValue(snaps.half);
  const start = useSharedValue(snaps.half);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    const target = mode === 'peek' ? snaps.peek : mode === 'full' ? snaps.full : snaps.half;
    height.value = withSpring(target, { damping: 22, stiffness: 220 });
    setShowList(target > snaps.peek + 28);
  }, [mode, snaps.peek, snaps.full, snaps.half, height]);

  const collapsed = !showList;

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      start.value = height.value;
    })
    .onUpdate((e) => {
      const next = Math.min(snaps.max, Math.max(snaps.min, start.value - e.translationY));
      height.value = next;
      runOnJS(setShowList)(next > snaps.peek + 28);
    })
    .onEnd(() => {
      const nextMode = snapModeWorklet(height.value, snaps);
      const target = snaps[nextMode];
      height.value = withSpring(target, { damping: 22, stiffness: 220 });
      runOnJS(setShowList)(target > snaps.peek + 28);
      runOnJS(onSnapMode)(nextMode);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: height.value
  }));

  const nextStop = markers[0];
  const peekLine = peekText !== undefined ? peekText : nextStop ? `${formatTime(nextStop.startTime)} · ${nextStop.place?.name}` : null;

  return (
    <Animated.View style={[styles.sheet, sheetStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.dragZone} accessibilityRole="adjustable" accessibilityLabel="일정 패널 크기 조절">
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
            <Text style={styles.dragHint}>위아래로 당겨 크기 조절</Text>
          </View>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title ?? (day ? `${day.dayIndex}일차  ${formatDay(day.date)}` : '일정 없음')}
              </Text>
              {collapsed && peekLine ? (
                <Text style={styles.peekMeta} numberOfLines={1}>
                  {peekLine}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onToggle} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={collapsed ? '목록 열기' : '목록 접기'}>
              <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink} />
            </Pressable>
            {hideNav ? null : (
              <>
                <Pressable disabled={dayIndex <= 0} onPress={onPrev} style={[styles.iconBtn, dayIndex <= 0 && styles.disabled]}>
                  <Icon name="chevron-back" size={16} color={colors.ink} />
                </Pressable>
                <Pressable
                  disabled={dayIndex >= days.length - 1}
                  onPress={onNext}
                  style={[styles.iconBtn, dayIndex >= days.length - 1 && styles.disabled]}
                >
                  <Icon name="chevron-forward" size={16} color={colors.ink} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </GestureDetector>
      {showList ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {children ?? <MapStopList markers={markers} items={items} onOpenPlace={onOpenPlace} />}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    ...shadow.float
  },
  dragZone: { paddingBottom: 2 },
  grabberWrap: { paddingVertical: 12, alignItems: 'center', gap: 4 },
  grabber: { width: 48, height: 5, borderRadius: 3, backgroundColor: colors.line },
  dragHint: { fontSize: 10, fontWeight: '600', color: colors.faint },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.xs },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  peekMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderRadius: 18
  },
  disabled: { opacity: 0.35 },
  list: { flex: 1 },
  listContent: { paddingBottom: space.xl }
});
