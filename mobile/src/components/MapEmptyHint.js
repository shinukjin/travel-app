import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, radius, shadow, space } from '../theme';
import { Icon } from '../ui';

const SHOW_MS = 3000;

/**
 * 선택한 날에 지도에 표시할 장소가 없을 때 지도 위에 띄우는 안내. 3초 뒤 저절로 사라진다.
 * 날짜가 바뀌면 다시 보이도록 부르는 쪽에서 key={day.id} 를 준다.
 */
export function MapEmptyHint({ noSchedule }) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setVisible(false));
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [opacity]);

  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.card, { opacity }]}>
        <Icon name="location-outline" size={20} color={colors.accent} />
        <Text style={styles.title}>{noSchedule ? '등록된 일정이 없어요' : '이 날은 지도에 표시할 장소가 없어요'}</Text>
        <Text style={styles.sub}>여행 탭의 일정에서 장소를 추가하면 여기에 핀으로 나타나요</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center', paddingHorizontal: space.xl },
  card: { alignItems: 'center', gap: 4, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: 'rgba(255,255,255,0.94)', ...shadow.float },
  title: { fontSize: 14, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 17 }
});
