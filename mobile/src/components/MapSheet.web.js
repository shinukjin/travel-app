import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapStopList } from './MapStopList';
import { clampHeight, computeSnaps, modeFromHeight } from './mapSheetSnap';
import { colors, formatDay, formatTime, shadow, space } from '../theme';
import { Icon } from '../ui';

export default function MapSheet({
  day,
  days,
  dayIndex,
  onPrev,
  onNext,
  markers,
  items,
  mode,
  onToggle,
  onSnapMode,
  frameHeight,
  onOpenPlace
}) {
  const insets = useSafeAreaInsets();
  const frame = frameHeight || 640;

  const snaps = useMemo(() => computeSnaps(frame, 0), [frame]);

  const heightAnim = useRef(new Animated.Value(snaps.half)).current;
  const startHeight = useRef(snaps.half);
  const [sheetHeight, setSheetHeight] = useState(snaps.half);

  useEffect(() => {
    const target = mode === 'peek' ? snaps.peek : mode === 'full' ? snaps.full : snaps.half;
    startHeight.current = target;
    setSheetHeight(target);
    Animated.spring(heightAnim, { toValue: target, useNativeDriver: false, damping: 22, stiffness: 220 }).start();
  }, [mode, snaps.peek, snaps.half, snaps.full, heightAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          heightAnim.stopAnimation((value) => {
            startHeight.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const next = clampHeight(startHeight.current - gesture.dy, snaps);
          heightAnim.setValue(next);
          setSheetHeight(next);
        },
        onPanResponderRelease: () => {
          heightAnim.stopAnimation((value) => {
            const nextMode = modeFromHeight(value, snaps);
            const target = snaps[nextMode];
            startHeight.current = target;
            setSheetHeight(target);
            Animated.spring(heightAnim, {
              toValue: target,
              useNativeDriver: false,
              damping: 22,
              stiffness: 220
            }).start();
            onSnapMode?.(nextMode);
          });
        }
      }),
    [heightAnim, onSnapMode, snaps]
  );

  const showList = sheetHeight > snaps.peek + 28;
  const nextStop = markers[0];

  return (
    <Animated.View style={[styles.sheet, { height: heightAnim }]}>
      <View style={styles.dragZone} {...panResponder.panHandlers} accessibilityRole="adjustable" accessibilityLabel="일정 패널 크기 조절">
        <View style={styles.grabberWrap}>
          <View style={styles.grabber} />
          <Text style={styles.dragHint}>위아래로 당겨 크기 조절</Text>
        </View>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {day ? `${day.dayIndex}일차  ${formatDay(day.date)}` : '일정 없음'}
            </Text>
            {!showList && nextStop ? (
              <Text style={styles.peekMeta} numberOfLines={1}>
                {formatTime(nextStop.startTime)} · {nextStop.place?.name}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onToggle} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={showList ? '목록 접기' : '목록 열기'}>
            <Icon name={showList ? 'chevron-down' : 'chevron-up'} size={16} color={colors.ink} />
          </Pressable>
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
        </View>
      </View>
      {showList ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <MapStopList markers={markers} items={items} onOpenPlace={onOpenPlace} />
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
    paddingBottom: space.sm,
    ...shadow.float
  },
  dragZone: { cursor: 'grab', touchAction: 'none' },
  grabberWrap: { paddingVertical: 10, alignItems: 'center', gap: 4 },
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
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingBottom: space.xl }
});
