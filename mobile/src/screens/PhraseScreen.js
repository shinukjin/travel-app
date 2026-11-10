import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuide } from '../GuideContext';
import { StackPage } from '../components/StackPage';
import { api } from '../api';
import { colors, radius, space, type } from '../theme';
import { Button, Empty, Field, Icon, TripPicker } from '../ui';

/** 여행 국가 → 음성/언어 코드 (입력 생략용) */
const LOCALE_BY_COUNTRY = {
  ES: 'es-ES',
  PT: 'pt-PT',
  FR: 'fr-FR',
  IT: 'it-IT',
  DE: 'de-DE',
  GB: 'en-GB',
  US: 'en-US',
  JP: 'ja-JP'
};

function guessLocale(trip, phrases) {
  const country = String(trip?.country || '').split(',')[0].trim().toUpperCase();
  return LOCALE_BY_COUNTRY[country] || phrases[phrases.length - 1]?.locale || '';
}

export default function PhraseScreen({ embed }) {
  const insets = useSafeAreaInsets();
  const { trip, trips, tripId, phrases, loading, selectTrip, refresh } = useGuide();
  const [query, setQuery] = useState('');
  const [situationFilter, setSituationFilter] = useState('ALL');
  const [slow, setSlow] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [showing, setShowing] = useState(null);
  const [composing, setComposing] = useState(false);
  const [situation, setSituation] = useState('');
  const [ko, setKo] = useState('');
  const [localText, setLocalText] = useState('');
  const [locale, setLocale] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultLocale = guessLocale(trip, phrases);

  useEffect(() => {
    setSituationFilter('ALL');
    setQuery('');
  }, [tripId]);

  useEffect(() => () => Speech.stop(), []);

  const situations = useMemo(() => [...new Set(phrases.map((p) => p.situation).filter(Boolean))], [phrases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return phrases.filter((p) => {
      if (situationFilter !== 'ALL' && p.situation !== situationFilter) return false;
      if (!q) return true;
      return [p.situation, p.ko, p.localText].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [phrases, query, situationFilter]);

  function speak(phrase) {
    if (speakingId === phrase.id) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    Speech.stop();
    setSpeakingId(phrase.id);
    const done = () => setSpeakingId((cur) => (cur === phrase.id ? null : cur));
    Speech.speak(phrase.localText, {
      language: phrase.locale,
      rate: slow ? 0.65 : 0.9,
      onDone: done,
      onStopped: done,
      onError: done
    });
  }

  async function addPhrase() {
    if (!trip) {
      Alert.alert('여행을 먼저 만드세요.', '도구 → 설정에서 새 여행을 추가할 수 있습니다.');
      return;
    }
    const s = situation.trim();
    const k = ko.trim();
    const l = localText.trim();
    const loc = (locale.trim() || defaultLocale).trim();
    if (!s || !k || !l) {
      Alert.alert('상황, 한국어, 현지어를 입력해 주세요.');
      return;
    }
    if (!loc) {
      Alert.alert('언어 코드를 입력해 주세요.', '예: es-ES, pt-PT, en-US');
      return;
    }
    setSaving(true);
    try {
      await api.createPhrase({ tripId: trip.id, situation: s, ko: k, localText: l, locale: loc });
      setSituation('');
      setKo('');
      setLocalText('');
      setComposing(false);
      await refresh();
    } catch (error) {
      Alert.alert('저장 실패', error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <StackPage title="회화" contentStyle={styles.body} embed={embed}>
      {trips.length > 1 ? <TripPicker trips={trips} tripId={tripId} onSelect={selectTrip} /> : null}

      {phrases.length ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Icon name="search" size={18} color={colors.faint} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="상황·한국어·현지어 검색"
                placeholderTextColor={colors.faint}
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="검색어 지우기">
                  <Icon name="close-circle" size={18} color={colors.faint} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => setSlow((v) => !v)}
              style={[styles.slow, slow && styles.slowOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: slow }}
              accessibilityLabel="천천히 읽기"
            >
              <Icon name="speedometer-outline" size={16} color={slow ? '#fff' : colors.ink} />
              <Text style={[styles.slowText, slow && styles.slowTextOn]}>천천히</Text>
            </Pressable>
          </View>

          {situations.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
              {['ALL', ...situations].map((s) => {
                const on = s === situationFilter;
                return (
                  <Pressable key={s} onPress={() => setSituationFilter(s)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{s === 'ALL' ? '전체' : s}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {filtered.length ? (
            filtered.map((phrase) => {
              const on = speakingId === phrase.id;
              return (
                <View key={phrase.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{phrase.situation}</Text>
                    </View>
                    <Pressable onPress={() => setShowing(phrase)} hitSlop={8} style={styles.showBtn} accessibilityRole="button" accessibilityLabel="상대에게 크게 보여주기">
                      <Icon name="scan-outline" size={16} color={colors.muted} />
                      <Text style={styles.showText}>크게 보기</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.local}>{phrase.localText}</Text>
                  <Text style={styles.ko}>{phrase.ko}</Text>
                  <Pressable
                    onPress={() => speak(phrase)}
                    style={({ pressed }) => [styles.play, on && styles.playOn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={on ? '재생 중지' : '현지어로 들려주기'}
                  >
                    <Icon name={on ? 'stop-circle' : 'volume-high'} size={20} color={on ? '#fff' : colors.accent} />
                    <Text style={[styles.playText, on && styles.playTextOn]}>{on ? '재생 중 · 탭하면 중지' : '들려주기'}</Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <Empty message="조건에 맞는 문장이 없습니다." />
          )}
        </>
      ) : (
        <Empty message="회화 없음 — 아래에서 추가하거나 어드민에서 등록하세요." />
      )}

      {composing ? (
        <View style={styles.compose}>
          <Text style={styles.composeTitle}>문장 추가</Text>
          <Field label="상황" value={situation} onChangeText={setSituation} placeholder="예: 택시 타기" />
          <Field label="한국어" value={ko} onChangeText={setKo} placeholder="말하고 싶은 내용" />
          <Field label="현지어" value={localText} onChangeText={setLocalText} placeholder="현지 표현" />
          {defaultLocale ? (
            <Text style={type.meta}>음성 언어: {locale.trim() || defaultLocale} (여행 국가 기준 자동 선택)</Text>
          ) : null}
          <Field
            label={defaultLocale ? '언어 코드 (바꾸려면 입력)' : '언어 코드'}
            value={locale}
            onChangeText={setLocale}
            placeholder="예: es-ES, pt-PT, en-US"
            autoCapitalize="none"
          />
          <View style={styles.composeActions}>
            <Button label="취소" variant="ghost" onPress={() => setComposing(false)} />
            <View style={styles.flex1}>
              <Button label={saving ? '저장 중…' : '저장'} onPress={addPhrase} disabled={saving || !trip} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setComposing(true)} style={styles.addBtn} accessibilityRole="button">
          <Icon name="add" size={20} color={colors.accent} />
          <Text style={styles.addText}>문장 직접 추가</Text>
        </Pressable>
      )}

      <Modal visible={!!showing} animationType="fade" onRequestClose={() => setShowing(null)}>
        <View style={[styles.full, { paddingTop: Math.max(insets.top, space.lg), paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <Pressable onPress={() => setShowing(null)} style={styles.fullClose} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={26} color="#fff" />
          </Pressable>
          <View style={styles.fullBody}>
            <Text style={styles.fullLocal} adjustsFontSizeToFit minimumFontScale={0.6}>
              {showing?.localText}
            </Text>
            <Text style={styles.fullKo}>{showing?.ko}</Text>
          </View>
          <Pressable
            onPress={() => showing && speak(showing)}
            style={styles.fullPlay}
            accessibilityRole="button"
            accessibilityLabel="들려주기"
          >
            <Icon name={showing && speakingId === showing.id ? 'stop-circle' : 'volume-high'} size={24} color={colors.navy} />
            <Text style={styles.fullPlayText}>{showing && speakingId === showing.id ? '중지' : '들려주기'}</Text>
          </Pressable>
        </View>
      </Modal>
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  flex1: { flex: 1 },
  pressed: { opacity: 0.9 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  slow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  slowOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  slowText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  slowTextOn: { color: '#fff' },
  chipScroll: { flexGrow: 0 },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextOn: { color: '#fff' },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.sheet,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.accentDark },
  showBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  showText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  local: { fontSize: 22, lineHeight: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  ko: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: space.xs,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: colors.accentSoft
  },
  playOn: { backgroundColor: colors.accent },
  playText: { fontSize: 14, fontWeight: '800', color: colors.accent },
  playTextOn: { color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line
  },
  addText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  compose: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.sheet,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  composeTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  composeActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  full: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: space.xl },
  fullClose: { alignSelf: 'flex-end', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  fullBody: { flex: 1, justifyContent: 'center', gap: space.xl },
  fullLocal: { fontSize: 44, lineHeight: 56, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  fullKo: { fontSize: 18, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  fullPlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.tram
  },
  fullPlayText: { fontSize: 16, fontWeight: '800', color: colors.navy }
});
