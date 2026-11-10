import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StackPage } from '../components/StackPage';
import { loadPlaceEnrichment } from '../placeInfo';
import { categoryMeta, colors, radius, space, type } from '../theme';
import { Button, Icon, Screen } from '../ui';

export default function PlaceInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const place = route.params?.place;
  const scheduleNote = route.params?.scheduleNote || '';
  const [loading, setLoading] = useState(true);
  const [wiki, setWiki] = useState(null);
  const [stale, setStale] = useState(false);
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!place) return undefined;
      let active = true;
      setLoading(true);
      (async () => {
        try {
          const data = await loadPlaceEnrichment(place);
          if (active) {
            setWiki(data.wiki);
            setStale(!data.wiki);
          }
        } catch {
          if (active) setStale(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [place])
  );

  if (!place) {
    return (
      <StackPage>
        <Text style={type.meta}>장소를 찾을 수 없습니다.</Text>
        <Button label="뒤로" onPress={() => navigation.goBack()} variant="ghost" />
      </StackPage>
    );
  }

  const meta = categoryMeta[place.category] || categoryMeta.SIGHT;
  // 좌표가 부정확할 수 있어 현지 이름(없으면 장소 이름)으로 구글 지도에서 검색한다
  const where = encodeURIComponent(place.nameLocal || place.name || '');
  const openRoute = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${where}`);
  const openMap = () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${where}`);
  const longText = (wiki?.extract || '').length > 180;

  return (
    <Screen scroll contentStyle={styles.body}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.head}>
          <Text style={styles.name} numberOfLines={2}>
            {place.name}
          </Text>
          <Text style={styles.sub}>
            <Text style={{ color: meta.color, fontWeight: '700' }}>{meta.label}</Text>
            {place.address ? `   ${place.address}` : ''}
          </Text>
        </View>
      </View>

      {wiki?.thumbnail ? <Image source={{ uri: wiki.thumbnail }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}

      <View style={styles.actions}>
        <Pressable onPress={openRoute} style={({ pressed }) => [styles.go, pressed && styles.pressed]} accessibilityRole="button">
          <Icon name="navigate" size={18} color="#fff" />
          <Text style={styles.goText}>길찾기</Text>
        </Pressable>
        <Pressable onPress={openMap} style={({ pressed }) => [styles.alt, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.altText}>지도 보기</Text>
        </Pressable>
      </View>

      {scheduleNote || place.memo ? (
        <View style={styles.notes}>
          {scheduleNote ? (
            <View style={styles.noteItem}>
              <Text style={styles.label}>이 날 메모</Text>
              <Text style={styles.text}>{scheduleNote}</Text>
            </View>
          ) : null}
          {place.memo ? (
            <View style={styles.noteItem}>
              <Text style={styles.label}>장소 메모</Text>
              <Text style={styles.text}>{place.memo}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
      ) : wiki ? (
        <View style={styles.noteItem}>
          <Text style={styles.label}>소개</Text>
          <Text style={styles.text} numberOfLines={open ? undefined : 5}>
            {wiki.extract}
          </Text>
          <View style={styles.foot}>
            {longText ? (
              <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.more}>{open ? '접기' : '더 보기'}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {wiki.pageUrl ? (
              <Pressable onPress={() => Linking.openURL(wiki.pageUrl)} hitSlop={8} accessibilityRole="link">
                <Text style={styles.credit}>Wikipedia</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : stale ? (
        <Text style={styles.hint}>온라인일 때 소개를 불러올 수 있어요.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  back: { width: 36, height: 40, justifyContent: 'center', marginLeft: -8 },
  head: { flex: 1, gap: 6 },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  sub: { fontSize: 14, lineHeight: 21, color: colors.muted },
  photo: { width: '100%', height: 200, borderRadius: radius.card },

  actions: { flexDirection: 'row', gap: space.sm },
  go: { flex: 1.4, height: 50, borderRadius: radius.control, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  alt: { flex: 1, height: 50, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  altText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.faint, marginTop: -space.sm },

  notes: { gap: space.lg },
  noteItem: { gap: 6, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  text: { fontSize: 16, lineHeight: 25, color: colors.ink },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  more: { fontSize: 14, fontWeight: '700', color: colors.accent },
  credit: { fontSize: 12, color: colors.faint }
});
