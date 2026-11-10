import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ART = require('../../assets/hero-sky.png');
const RATIO = 1080 / 780;

/**
 * 히어로 배경 일러스트. 영역을 꽉 채우되(cover) 항상 아래쪽 기준으로 맞춰,
 * 노을·항로·비행기가 있는 아랫부분이 보이게 한다. 내용은 children 으로 위에 올린다.
 */
export function HeroArt({ children, style, shade = 0.55 }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const width = Math.max(box.w, box.h * RATIO);
  const height = width / RATIO;

  return (
    <View
      style={[styles.root, style]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 ? (
        <Image
          source={ART}
          style={{ position: 'absolute', width, height, left: (box.w - width) / 2, top: box.h - height }}
          resizeMode="stretch"
        />
      ) : null}
      <LinearGradient colors={['rgba(10,27,48,0)', `rgba(10,27,48,${shade})`]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: '#12315A' }
});
