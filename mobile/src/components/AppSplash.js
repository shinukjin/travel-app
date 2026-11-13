import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Text } from '../Text';
import { colors } from '../theme';
import { APP_VERSION_LABEL } from '../appVersion';

const LOGO = require('../../assets/logo.png');
const LOGO_SIZE = 184;
/** 데이터가 빨리 와도 최소한 이 시간은 보여 준다 (깜빡임 방지) */
const MIN_VISIBLE_MS = 1600;
const FADE_MS = 380;
const native = Platform.OS !== 'web';
/** 앱 실행 중 이미 한 번 보여 줬다면(예: 로그인 직후) 최소 노출 시간을 건너뛴다 */
let shownOnce = false;

/** 폰트 로딩 전용 — 네이티브 스플래시와 같은 위치에 로고만 보여 준다 (텍스트 없음) */
export function SplashBase() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={LOGO} style={styles.logo} />
    </View>
  );
}

function Dot({ delay }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 360, easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.delay(480 - delay)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, v]);
  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }
      ]}
    />
  );
}

/**
 * 앱 시작 로딩 화면 — 데이터가 준비(ready)되고 최소 노출 시간이 지나면 부드럽게 사라진다.
 */
export function AppSplash({ ready }) {
  const [elapsed, setElapsed] = useState(shownOnce);
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = shownOnce ? null : setTimeout(() => setElapsed(true), MIN_VISIBLE_MS);
    Animated.timing(enter, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native })
      ])
    );
    loop.start();
    return () => {
      if (t) clearTimeout(t);
      loop.stop();
    };
  }, [enter, float]);

  useEffect(() => {
    if (ready && elapsed) {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: native }).start(() => {
        shownOnce = true;
        setGone(true);
      });
    }
  }, [ready, elapsed, fade]);

  if (gone) return null;

  return (
    <Animated.View style={[styles.root, styles.overlay, { opacity: fade }]} pointerEvents={ready && elapsed ? 'none' : 'auto'}>
      <StatusBar style="light" />
      <Animated.View
        style={{
          transform: [
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }
          ]
        }}
      >
        <Image source={LOGO} style={styles.logo} />
      </Animated.View>

      <Animated.View style={[styles.copy, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <Text style={styles.title}>Honeymoon Guide</Text>
        <Text style={styles.tagline}>우리 둘만의 여행 가이드</Text>
      </Animated.View>

      <View style={styles.loading}>
        <View style={styles.dots}>
          <Dot delay={0} />
          <Dot delay={160} />
          <Dot delay={320} />
        </View>
        <Text style={styles.loadingText}>여행을 준비하고 있어요</Text>
      </View>
      <Text style={styles.version}>{APP_VERSION_LABEL}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 100 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  copy: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: LOGO_SIZE / 2 + 28, alignItems: 'center', gap: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.65)' },
  loading: { position: 'absolute', bottom: 72, alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row', gap: 8, height: 14, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.tram },
  loadingText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  version: { position: 'absolute', bottom: 28, fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' }
});
