import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { colors, formatDay, radius, space } from '../theme';
import { Icon, Screen, shortTitle } from '../ui';
import { storage } from '../storage';
import { deleteMemo, syncPendingMemos } from '../sync';
import { useGuide } from '../GuideContext';
import { useToast } from '../Toast';

/** 로컬 시각 기준 ISO (UTC 변환 없이) */
function nowIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

function todayHeading() {
  return formatDay(nowIso().slice(0, 10));
}

function prettyTime(value) {
  const raw = String(value || '').replace('T', ' ');
  return raw.length >= 16 ? raw.slice(11, 16) : raw;
}

function groupByDay(memos) {
  const map = {};
  memos.forEach((memo) => {
    const day = String(memo.createdAt).slice(0, 10);
    (map[day] = map[day] || []).push(memo);
  });
  return Object.entries(map)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({
      day,
      items: items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    }));
}

export default function MemoScreen({ embed }) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [withLocation, setWithLocation] = useState(true);
  const [allMemos, setMemos] = useState([]);
  // 메모는 홈에서 선택한 여행에 저장되고, 목록도 그 여행의 기록만 보여 준다
  const { trip } = useGuide();
  const memos = useMemo(() => (trip ? allMemos.filter((m) => m.tripId === trip.id) : allMemos), [allMemos, trip]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const refresh = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (net.isConnected) setMemos(await syncPendingMemos());
    else setMemos(await storage.getMemos());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const unsub = NetInfo.addEventListener((state) => {
        if (state.isConnected) syncPendingMemos().then(setMemos);
      });
      return () => unsub();
    }, [refresh])
  );

  const pendingCount = memos.filter((m) => m.syncStatus !== 'synced').length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? memos.filter((m) => String(m.content || '').toLowerCase().includes(q)) : memos;
  }, [memos, query]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const canSave = content.trim().length > 0 && !saving;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function submit() {
    if (!canSave) return;
    if (!trip) {
      Alert.alert('여행이 없어요', '도구 → 설정에서 먼저 여행을 만들어 주세요.');
      return;
    }
    setSaving(true);
    try {
      const createdAt = nowIso();
      let coords = { lat: null, lng: null };
      if (withLocation) {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({});
            coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          }
        } catch {
          /* 위치를 못 가져와도 메모는 저장 */
        }
      }
      const memo = {
        clientId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        tripId: trip.id,
        content: content.trim(),
        photoUri,
        lat: coords.lat,
        lng: coords.lng,
        createdAt,
        syncStatus: 'pending'
      };
      const next = [memo, ...(await storage.getMemos())];
      await storage.setMemos(next);
      setMemos(next);
      setContent('');
      setPhotoUri(null);
      setFocused(false);
      toast.show('기록을 저장했어요');
      const net = await NetInfo.fetch();
      if (net.isConnected) setMemos(await syncPendingMemos());
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(memo) {
    Alert.alert('기록 삭제', '이 기록을 삭제할까요? 삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setMemos(await deleteMemo(memo));
            toast.show('기록을 삭제했어요');
          } catch {
            Alert.alert('삭제하지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요.');
          }
        }
      }
    ]);
  }

  return (
    <Screen scroll inHub={embed} contentStyle={styles.body}>
      <View style={styles.composer}>
        <View style={styles.composerHead}>
          <Text style={styles.today}>{todayHeading()}</Text>
          {trip ? (
            <View style={styles.tripTag}>
              <Text style={styles.tripTagText} numberOfLines={1}>
                {shortTitle(trip.title)}
              </Text>
            </View>
          ) : null}
        </View>
        <TextInput
          style={[styles.editor, focused && styles.editorFocus]}
          multiline
          placeholder="지금 무슨 생각이 드나요? 오늘의 순간을 남겨 보세요"
          placeholderTextColor={colors.faint}
          value={content}
          onChangeText={setContent}
          onFocus={() => setFocused(true)}
          textAlignVertical="top"
        />
        {photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <Pressable style={styles.photoRemove} onPress={() => setPhotoUri(null)} accessibilityRole="button" accessibilityLabel="사진 제거">
              <Icon name="close" size={14} color="white" />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.bar}>
          <Pressable onPress={pickPhoto} style={styles.chip} accessibilityRole="button" accessibilityLabel="사진 첨부">
            <Icon name="image-outline" size={18} color={colors.ink} />
            <Text style={styles.chipText}>사진</Text>
          </Pressable>
          <Pressable
            onPress={() => setWithLocation((v) => !v)}
            style={[styles.chip, withLocation && styles.chipOn]}
            accessibilityRole="switch"
            accessibilityState={{ checked: withLocation }}
            accessibilityLabel="현재 위치 함께 기록"
          >
            <Icon name={withLocation ? 'location' : 'location-outline'} size={18} color={withLocation ? colors.accent : colors.muted} />
            <Text style={[styles.chipText, withLocation && styles.chipTextOn]}>위치</Text>
          </Pressable>
          <View style={styles.grow} />
          <Pressable onPress={submit} disabled={!canSave} style={[styles.save, !canSave && styles.saveOff]} accessibilityRole="button" accessibilityLabel="저장">
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>저장</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.listHead}>
        <Text style={styles.listTitle}>지난 기록</Text>
        <Text style={styles.listCount}>
          {memos.length ? `${memos.length}개` : ''}
          {pendingCount ? ` · 동기화 대기 ${pendingCount}` : ''}
        </Text>
      </View>

      {memos.length > 4 ? (
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="기록 검색" placeholderTextColor={colors.faint} />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="검색어 지우기">
              <Icon name="close-circle" size={18} color={colors.faint} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!memos.length ? (
        <View style={styles.emptyCard}>
          <Icon name="create-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>아직 남긴 기록이 없어요</Text>
          <Text style={styles.emptyText}>위 입력창에 한 줄만 써도 날짜와 위치가 함께 저장돼요.</Text>
        </View>
      ) : null}
      {memos.length && !filtered.length ? <Text style={styles.noResult}>검색 결과가 없어요.</Text> : null}

      {groups.map(({ day, items }) => (
        <View key={day} style={styles.dayBlock}>
          <View style={styles.dayHead}>
            <Text style={styles.dayLabel}>{formatDay(day)}</Text>
            <Text style={styles.dayCount}>{items.length}</Text>
          </View>
          {items.map((memo) => (
            <View key={memo.clientId} style={styles.entry}>
              <View style={styles.entryTop}>
                <Text style={styles.entryTime}>{prettyTime(memo.createdAt)}</Text>
                {memo.lat != null ? <Icon name="location" size={12} color={colors.faint} /> : null}
                {memo.syncStatus === 'synced' ? null : (
                  <View style={styles.pending}>
                    <Text style={styles.pendingText}>대기</Text>
                  </View>
                )}
                <View style={styles.grow} />
                <Pressable onPress={() => confirmDelete(memo)} hitSlop={10} accessibilityRole="button" accessibilityLabel="기록 삭제">
                  <Icon name="trash-outline" size={18} color={colors.faint} />
                </Pressable>
              </View>
              <Text style={styles.entryBody}>{memo.content}</Text>
              {memo.photoUri ? <Image source={{ uri: memo.photoUri }} style={styles.entryPhoto} /> : null}
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  grow: { flex: 1 },
  composer: { gap: space.md, padding: space.lg, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  composerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  today: { fontSize: 15, fontWeight: '800', color: colors.ink },
  tripTag: { maxWidth: '55%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  tripTagText: { fontSize: 12, fontWeight: '700', color: colors.accentDark },
  editor: { minHeight: 96, padding: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, fontSize: 17, lineHeight: 26, color: colors.ink },
  editorFocus: { minHeight: 150 },
  photoWrap: { borderRadius: radius.control, overflow: 'hidden' },
  photo: { width: '100%', height: 180, backgroundColor: colors.surfaceMuted },
  photoRemove: { position: 'absolute', top: space.sm, right: space.sm, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipOn: { backgroundColor: colors.accentSoft },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  chipTextOn: { color: colors.accentDark },
  save: { minWidth: 72, height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveOff: { backgroundColor: colors.faint, opacity: 0.6 },
  saveText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  listTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  listCount: { fontSize: 12, fontWeight: '600', color: colors.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 44, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  noResult: { textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: space.lg },
  dayBlock: { gap: space.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dayLabel: { fontSize: 14, fontWeight: '800', color: colors.accent },
  dayCount: { fontSize: 12, fontWeight: '700', color: colors.faint },
  entry: { gap: 6, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTime: { fontSize: 12, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'] },
  pending: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.tramSoft },
  pendingText: { fontSize: 10, fontWeight: '800', color: '#8A5A00' },
  entryBody: { fontSize: 16, lineHeight: 24, color: colors.ink },
  entryPhoto: { width: '100%', height: 200, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, marginTop: 4 }
});
