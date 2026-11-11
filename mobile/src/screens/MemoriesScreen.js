import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { LinearGradient } from 'expo-linear-gradient';
import { HighlightVideo } from '../components/HighlightVideo';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryLabels } from '../countries';
import { colors, formatDay, formatRange, radius, space } from '../theme';
import { Icon, Screen, TripPicker } from '../ui';
import { storage } from '../storage';
import { createHighlightVideo } from '../highlight';
import { loadGuideCache, matchTripByDate, syncPendingMedia } from '../sync';

function toLocalDateTime(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

export default function MemoriesScreen({ embed }) {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(null);
  const [media, setMedia] = useState([]);
  const [busy, setBusy] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [viewIndex, setViewIndex] = useState(null);

  const refresh = useCallback(async () => {
    const cache = await loadGuideCache();
    setTrips(cache.trips);
    setTripId((current) => current || cache.trips[0]?.id || null);
    try {
      setMedia(await syncPendingMedia());
    } catch {
      setMedia(await storage.getMedia());
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const trip = trips.find((item) => item.id === tripId);
  const filtered = useMemo(
    () => media.filter((item) => item.tripId === tripId).sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt))),
    [media, tripId]
  );
  const coverUri = filtered[0]?.localUri;
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((item, index) => {
      const day = String(item.capturedAt).slice(0, 10);
      (map[day] = map[day] || []).push({ item, index });
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  async function addAsset(asset, capturedAt) {
    const cache = await loadGuideCache();
    const matched = matchTripByDate(cache.trips, capturedAt) || cache.trips.find((item) => item.id === tripId);
    if (!matched) {
      Alert.alert('여행 기간을 찾을 수 없어요', '촬영일이 여행 기간에 포함되어야 해요.');
      return;
    }
    let lat = asset.exif?.GPSLatitude ?? null;
    let lng = asset.exif?.GPSLongitude ?? null;
    if (lat == null || lng == null) {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tripId: matched.id,
      localUri: asset.uri,
      mediaType: 'PHOTO',
      capturedAt,
      lat,
      lng,
      syncStatus: 'pending'
    };
    const next = [entry, ...(await storage.getMedia())];
    await storage.setMedia(next);
    setMedia(next);
    setTripId(matched.id);
    try {
      setMedia(await syncPendingMedia());
    } catch {
      /* offline */
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: true });
    if (!result.canceled) await addAsset(result.assets[0], toLocalDateTime(new Date()));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const captured = asset.exif?.DateTimeOriginal
      ? asset.exif.DateTimeOriginal.replace(':', '-').replace(':', '-').replace(' ', 'T')
      : toLocalDateTime(new Date());
    await addAsset(asset, captured.slice(0, 19));
  }

  async function makeHighlight() {
    const photos = [...filtered].sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
    if (!photos.length) {
      Alert.alert('사진이 없어요');
      return;
    }
    setBusy(true);
    try {
      setVideoUri(await createHighlightVideo(photos, tripId));
    } catch (error) {
      Alert.alert('하이라이트 생성 실패', error.message);
    } finally {
      setBusy(false);
    }
  }

  const tripMeta = trip ? [countryLabels(trip.country), formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ') : '';
  const current = viewIndex != null ? filtered[viewIndex] : null;

  return (
    <Screen scroll inHub={embed} contentStyle={styles.page}>
      {trips.length > 1 ? <TripPicker trips={trips} tripId={tripId} onSelect={setTripId} /> : null}

      {coverUri ? (
        <ImageBackground source={{ uri: coverUri }} imageStyle={styles.coverImage} style={styles.cover}>
          <LinearGradient colors={['transparent', 'rgba(16,38,63,0.78)']} style={StyleSheet.absoluteFill} />
          <View style={styles.coverCopy}>
            <Text style={styles.coverCount}>{filtered.length}장</Text>
            <Text style={styles.coverMeta} numberOfLines={1}>
              {tripMeta}
            </Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Icon name="images-outline" size={24} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>첫 사진을 남겨 보세요</Text>
          <Text style={styles.emptyText}>사진 원본은 이 기기에만 있고, 서버에는 날짜·위치 정보만 저장돼요.</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.actionPrimary]} onPress={takePhoto} accessibilityRole="button" accessibilityLabel="촬영">
          <Icon name="camera" size={20} color="#fff" />
          <Text style={styles.actionTextOn}>촬영</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="앨범에서 불러오기">
          <Icon name="images-outline" size={20} color={colors.ink} />
          <Text style={styles.actionText}>앨범에서</Text>
        </Pressable>
      </View>

      {videoUri ? <HighlightVideo key={videoUri} uri={videoUri} style={styles.video} /> : null}

      {groups.map(([day, entries]) => (
        <View key={day} style={styles.group}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{formatDay(day)}</Text>
            <Text style={styles.groupCount}>{entries.length}</Text>
          </View>
          <View style={styles.grid}>
            {entries.map(({ item, index }) => (
              <Pressable key={item.id} onPress={() => setViewIndex(index)} style={styles.cell} accessibilityRole="imagebutton" accessibilityLabel="사진 크게 보기">
                <Image source={{ uri: item.localUri }} style={styles.thumb} />
                {item.syncStatus !== 'synced' ? <View style={styles.pendingDot} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Modal visible={current != null} animationType="fade" onRequestClose={() => setViewIndex(null)}>
        <View style={[styles.viewer, { paddingTop: Math.max(insets.top, space.md), paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={styles.viewerTop}>
            <Text style={styles.viewerCount}>{current ? `${viewIndex + 1} / ${filtered.length}` : ''}</Text>
            <Pressable onPress={() => setViewIndex(null)} style={styles.viewerClose} accessibilityRole="button" accessibilityLabel="닫기">
              <Icon name="close" size={26} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.viewerBody}>
            {current ? <Image source={{ uri: current.localUri }} style={styles.viewerImage} resizeMode="contain" /> : null}
          </View>
          <View style={styles.viewerBottom}>
            <Pressable
              onPress={() => setViewIndex((i) => Math.max(0, i - 1))}
              disabled={viewIndex === 0}
              style={[styles.nav, viewIndex === 0 && styles.navOff]}
              accessibilityLabel="이전 사진"
            >
              <Icon name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.viewerDate}>{current ? `${formatDay(String(current.capturedAt).slice(0, 10))} ${String(current.capturedAt).slice(11, 16)}` : ''}</Text>
            <Pressable
              onPress={() => setViewIndex((i) => Math.min(filtered.length - 1, i + 1))}
              disabled={viewIndex === filtered.length - 1}
              style={[styles.nav, viewIndex === filtered.length - 1 && styles.navOff]}
              accessibilityLabel="다음 사진"
            >
              <Icon name="chevron-forward" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg },
  cover: { height: 200, borderRadius: radius.sheet, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.navy },
  coverImage: { resizeMode: 'cover' },
  coverCopy: { padding: space.lg, gap: 2 },
  coverCount: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  coverMeta: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', maxWidth: '65%' },
  play: { position: 'absolute', right: space.lg, bottom: space.lg, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, height: 38, borderRadius: radius.pill, backgroundColor: colors.tram },
  playText: { fontSize: 13, fontWeight: '800', color: colors.navy },
  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  actionTextOn: { fontSize: 15, fontWeight: '700', color: '#fff' },
  video: { width: '100%', height: 200, borderRadius: radius.card, backgroundColor: colors.navy, overflow: 'hidden' },
  group: { gap: space.sm },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  groupCount: { fontSize: 12, fontWeight: '700', color: colors.faint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '32.4%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  thumb: { width: '100%', height: '100%' },
  pendingDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tram },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  viewerCount: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  viewerClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewerBody: { flex: 1, justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  viewerDate: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  nav: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.3 }
});
