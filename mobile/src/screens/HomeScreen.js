import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sortTripsForHome, useGuide } from '../GuideContext';
import { storage } from '../storage';
import { clockFor, timezonesForTrip } from '../countryInfo';
import { navigatePlaceInfo } from '../placeInfo';
import { navigateHub, quickActions, TAB_ROUTES } from '../tools';
import { TAB_BAR_BASE, colors, formatDay, formatRange, formatTime, radius, shadow, space } from '../theme';
import { countryLabels } from '../countries';
import { useLayout } from '../layout';
import { HeroArt } from '../components/HeroArt';
import { Icon } from '../ui';

const DAY_MS = 86400000;
const OVERLAP = 44;

/** 여행 상태: D-3 / D-Day · D+2(여행 중) / D+42(다녀옴) */
function tripBadge(trip) {
  if (!trip?.startDate || !trip?.endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T00:00:00`);
  const total = Math.round((end - start) / DAY_MS) + 1;
  if (today < start) {
    return { text: `D-${Math.round((start - today) / DAY_MS)}`, label: '출발까지', sub: `${formatDay(trip.startDate)} 출발`, live: false };
  }
  // 상태가 달라도 같은 모양(D-숫자) · 같은 줄 수로 보여 히어로 높이와 배경 이미지가 변하지 않게 한다
  if (today > end) {
    return { text: `D+${Math.round((today - end) / DAY_MS)}`, label: '다녀온 여행', sub: `${formatDay(trip.endDate)} 종료`, live: false, done: true, total };
  }
  const nth = Math.round((today - start) / DAY_MS) + 1;
  return { text: nth === 1 ? 'D-Day' : `D+${nth - 1}`, label: '여행 중', sub: `총 ${total}일 중 ${nth}일차`, live: true, nth, total };
}

/** 각 영역이 차지하는 대략의 높이(간격 포함) — 한 화면에 얼마나 담을지 계산할 때 쓴다 */
const COST = { today: 64, card: 56, quickRow: 112, quickMore: 76 };

const QUICK_COMPACT = ['schedule', 'map', 'voucher', 'memo'];
/** 넘칠 때 한 번에 덜어 낼 높이와 최대 횟수 */
const SHRINK_STEP = 48;
const MAX_SHRINK = 4;

/**
 * 히어로 아래 남는 높이(budget)에 맞춰 보여 줄 양을 정한다 — 스크롤 없이 한 화면에 꽉 차게.
 * 꼭 필요한 것(오늘 일정·안내 카드·빠른 실행 4개)을 먼저 빼고, 남으면 빠른 실행을 전체(8개)로 늘린다.
 */
function densityFor({ budget, hasToday, cards }) {
  const free = budget - (hasToday ? COST.today : 0) - cards * COST.card - COST.quickRow;
  return { quickAll: free >= COST.quickMore };
}

function SectionHead({ title }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { trip, trips, tripId, days, loading, offline, selectTrip, nextStop, packedCount, packing, todayDay } = useGuide();

  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [recap, setRecap] = useState({ memos: 0, photos: 0 });
  // 내용이 화면보다 길면 한 단계씩 줄인다 (0 = 계산한 그대로)
  const [shrink, setShrink] = useState(0);
  // 현지 시각은 1분마다 갱신
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 다녀온 여행의 추억 요약 (이 기기에 저장된 메모·사진 개수)
  const recapTripId = trip?.id;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [memos, media] = await Promise.all([storage.getMemos(), storage.getMedia()]);
        if (active) {
          setRecap({
            memos: memos.filter((m) => m.tripId === recapTripId).length,
            photos: media.filter((m) => m.tripId === recapTripId).length
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [recapTripId])
  );

  // 화면 크기나 보여 줄 여행이 바뀌면 다시 계산
  useEffect(() => {
    setShrink(0);
  }, [tripId, layout.width, layout.height, insets.top, insets.bottom]);

  // 실제 내용 높이가 화면보다 크면 한 단계 더 줄인다 (최대 MAX_SHRINK 번)
  useEffect(() => {
    if (viewH > 0 && contentH > viewH + 1 && shrink < MAX_SHRINK) setShrink((s) => s + 1);
  }, [contentH, viewH]);

  // 홈은 남색 히어로가 맨 위까지 올라오므로, 보이는 동안만 상태바(시간·배터리)를 밝은 색으로
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const badge = tripBadge(trip);
  const done = Boolean(badge?.done);
  const eyebrow = trip ? [countryLabels(trip.country), offline ? '오프라인' : null].filter(Boolean).join(' · ') : '';
  const meta = trip ? [trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ') : '';
  const packRatio = packing.length ? packedCount / packing.length : 0;
  // 히어로 높이는 화면 높이로만 정한다 — 아래 내용이 달라져도 높이와 배경 이미지가 변하지 않게
  // 시간 칩 + 제목·날짜·여행 칩이 들어갈 만큼만 (상태바가 높은 폰은 그만큼 더)
  const heroHeight = Math.round(Math.min(310, Math.max(270 + Math.max(insets.top - 24, 0), layout.height * 0.34)));
  const scheduledCount = (days || []).reduce((sum, d) => sum + (d.items?.length || 0), 0);
  const visitedPlaces = new Set((days || []).flatMap((d) => (d.items || []).map((i) => i.place?.id).filter(Boolean))).size;

  // 다음 일정은 여행 중일 때만, 시간과 장소 이름만 한 줄로 보여 준다
  // (출발 전·다녀온 뒤에는 홈에 일정을 올리지 않는다)
  const showToday = Boolean(nextStop && badge?.live);
  // 안내·요약 카드 개수 (여행이 없으면 온보딩 카드가 크므로 3장으로 센다)
  const cards = !trip ? 3 : 1 + (!scheduledCount ? 1 : 0);
  const density = densityFor({
    // 실제로 넘치면(shrink) 한 단계씩 항목을 덜어 내 스크롤이 생기지 않게 한다
    budget: layout.height - heroHeight + OVERLAP - (TAB_BAR_BASE + insets.bottom + space.md) - shrink * SHRINK_STEP,
    hasToday: showToday,
    cards
  });
  const quick = quickActions().filter((a) => density.quickAll || QUICK_COMPACT.includes(a.key));
  const orderedTrips = sortTripsForHome(trips);

  // 여행지 현지 시각과 한국과의 시차 — 히어로 상단에 칩으로 (나라가 여러 곳이어도 시간대가 다른 곳만, 최대 2개)
  const clocks = trip && !done
    ? timezonesForTrip(trip)
        .filter((z) => z.tz !== 'Asia/Seoul')
        .slice(0, 2)
        .map((z) => ({ ...z, name: countryLabels(z.countries.join(',')), ...clockFor(z.tz, now) }))
        .filter((c) => c.time)
    : [];

  const frame =
    layout.width > layout.contentMaxWidth ? { maxWidth: layout.contentMaxWidth, width: '100%', alignSelf: 'center' } : null;

  const goNewTrip = () =>
    navigation.navigate('Tabs', { screen: TAB_ROUTES.tools, params: { section: 'settings', newTrip: Date.now() } });
  const goSchedule = () => navigation.navigate('Tabs', { screen: TAB_ROUTES.travel, params: { section: 'schedule' } });
  const goPacking = () => navigation.navigate('Tabs', { screen: TAB_ROUTES.travel, params: { section: 'packing' } });
  const goRecord = (section) => navigation.navigate('Tabs', { screen: TAB_ROUTES.record, params: { section } });

  return (
    <ScrollView
      style={styles.root}
      // 내용이 넘칠 때만 스크롤된다
      contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_BASE + insets.bottom + space.md }}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
      onContentSizeChange={(_, h) => setContentH(h)}
      scrollEnabled={contentH > viewH + 1}
    >
      {/* ───────── 히어로 ───────── */}
      <View style={styles.heroWrap}>
        <HeroArt style={[styles.hero, { height: heroHeight, paddingTop: Math.max(insets.top, space.md) + space.md }]}>
          <View style={[styles.heroInner, frame, { paddingHorizontal: layout.gutter }]}>
            {/* 현지 시간 — 상단 */}
            <View style={styles.clockRow}>
              {clocks.map((c) => (
                <View key={c.tz} style={styles.clockChip} accessibilityLabel={`${c.name} 현지 시간 ${c.time}, ${c.label}`}>
                  <Text style={styles.clockName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.clockTime} numberOfLines={1}>{c.time}</Text>
                  <Text style={styles.clockDiff} numberOfLines={1}>{c.short}</Text>
                </View>
              ))}
            </View>

            <View style={styles.heroBottom}>
              {trip ? (
                <>
                  <Text style={styles.eyebrow} numberOfLines={1}>
                    {eyebrow || ' '}
                  </Text>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {trip.title}
                    </Text>
                    {badge ? (
                      <View style={[styles.dday, badge.live && styles.ddayLive, badge.done && styles.ddayDone]} accessibilityLabel={`${badge.label} ${badge.text}`}>
                        <Text style={[styles.ddayLabel, badge.done && styles.ddayTextDone]}>{badge.label}</Text>
                        <Text style={[styles.ddayNum, badge.done && styles.ddayTextDone]}>{badge.text}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {meta || ' '}
                    {/* 여행 중이면 "총 12일 중 3일차" — 지금이 몇 일차인지 눈에 띄는 색으로 */}
                    {badge?.live ? (
                      <>
                        {` · 총 ${badge.total}일 중 `}
                        <Text style={styles.metaDay}>{`${badge.nth}일차`}</Text>
                      </>
                    ) : null}
                  </Text>
                  {trips.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
                      {orderedTrips.map((t) => {
                        const on = t.id === tripId;
                        return (
                          <Pressable key={t.id} onPress={() => selectTrip(t.id)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                              {String(t.title || '').replace(/\s*신혼여행\s*$/, '') || t.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.eyebrow}>Honeymoon Guide</Text>
                  <Text style={styles.title}>우리의 여행이{'\n'}여기서 시작돼요</Text>
                </>
              )}
            </View>
          </View>
        </HeroArt>
      </View>

      <View style={[styles.body, frame, { paddingHorizontal: layout.gutter }]}>
        {/* ───────── 온보딩 ───────── */}
        {!trip ? (
          <View style={styles.onboard}>
            <Text style={styles.onboardTitle}>세 단계면 준비 끝</Text>
            <View style={styles.steps}>
              {[
                { n: 1, title: '여행 만들기', sub: '이름·국가·기간을 입력해요' },
                { n: 2, title: '일정 등록하기', sub: '일차별로 가고 싶은 장소를 담아요' },
                { n: 3, title: '준비물·티켓 챙기기', sub: '예약번호와 체크리스트를 모아 둬요' }
              ].map((s) => (
                <View key={s.n} style={styles.step}>
                  <View style={[styles.stepNum, s.n === 1 && styles.stepNumNow]}>
                    <Text style={[styles.stepNumText, s.n === 1 && styles.stepNumTextNow]}>{s.n}</Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Pressable onPress={goNewTrip} style={({ pressed }) => [styles.onboardBtn, pressed && styles.pressed]} accessibilityRole="button">
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.onboardBtnText}>여행 만들기</Text>
            </Pressable>
          </View>
        ) : null}

        {done ? (
          /* ───────── 다녀온 여행: 추억 돌아보기 ───────── */
          <>
            <View style={styles.stats}>
              {[
                { n: badge.total, label: '여행 일수' },
                { n: visitedPlaces, label: '방문 장소' },
                { n: recap.memos, label: '메모' },
                { n: recap.photos, label: '사진' }
              ].map((s, i) => (
                <View key={s.label} style={[styles.stat, i > 0 && styles.statDivider]}>
                  <Text style={styles.statNum}>{s.n}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.block}>
              <SectionHead title="추억 돌아보기" />
              <View style={styles.tiles}>
                {[
                  { key: 'photos', label: '사진 모아보기', icon: 'images', tint: '#D5EEEE', color: '#0F7C7C', onPress: () => goRecord('memories') },
                  { key: 'memo', label: '남긴 기록', icon: 'create', tint: '#E9E3F5', color: '#6B4FA3', onPress: () => goRecord('memo') },
                  { key: 'schedule', label: '일정 돌아보기', icon: 'calendar', tint: '#DFE8F6', color: '#1F4FA3', onPress: goSchedule }
                ].map((t) => (
                  <Pressable key={t.key} onPress={t.onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={t.label}>
                    <View style={[styles.tileIcon, { backgroundColor: t.tint }]}>
                      <Icon name={t.icon} size={24} color={t.color} />
                    </View>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable onPress={goNewTrip} style={({ pressed }) => [styles.newTrip, pressed && styles.pressed]} accessibilityRole="button">
              <Icon name="add" size={18} color={colors.accent} />
              <Text style={styles.newTripText}>다음 여행 만들기</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* ───────── 다음 장소 + 오늘 일정 (한 카드) ───────── */}
            {/* 다음 일정 — 한 줄로 슬림하게 (시간 · 장소 · 남은 시간 / 전체 보기) */}
            {showToday ? (
              // 버튼 안에 버튼을 넣으면 웹에서 오류가 나므로, 카드(View) 안에 두 버튼을 나란히 둔다
              <View style={styles.today}>
                <Pressable
                  style={({ pressed }) => [styles.todayMain, pressed && styles.pressed]}
                  onPress={() => navigatePlaceInfo(navigation, nextStop.place, nextStop.note)}
                  accessibilityRole="button"
                  accessibilityLabel={`다음 장소 ${nextStop.place?.name}, ${formatTime(nextStop.startTime)}`}
                >
                  <View style={styles.todayTimeBox}>
                    <Text style={styles.todayTime} numberOfLines={1}>
                      {formatTime(nextStop.startTime)}
                    </Text>
                  </View>
                  {/* 핀 + 장소 이름 */}
                  <View style={styles.todayPlace}>
                    <View style={styles.todayPin}>
                      <Icon name="location" size={14} color={colors.accent} />
                    </View>
                    <Text style={styles.todayName} numberOfLines={1}>
                      {nextStop.place?.name}
                    </Text>
                  </View>
                </Pressable>
                {/* 전체 일정으로 */}
                <Pressable onPress={goSchedule} hitSlop={8} style={styles.todayGo} accessibilityRole="button" accessibilityLabel="전체 일정 보기">
                  <Icon name="chevron-forward" size={18} color={colors.ink} />
                </Pressable>
              </View>
            ) : null}

            {/* 안내·요약은 모두 한 줄짜리 슬림 행 */}
            {trip && !scheduledCount ? (
              <Pressable onPress={goSchedule} style={({ pressed }) => [styles.slim, pressed && styles.pressed]} accessibilityRole="button">
                <Icon name="calendar-outline" size={18} color={colors.accent} />
                <Text style={styles.slimLabel}>일정 등록하기</Text>
                <View style={styles.flex1} />
                <Icon name="chevron-forward" size={14} color={colors.faint} />
              </Pressable>
            ) : null}

            {trip && packing.length ? (
              <Pressable onPress={goPacking} style={({ pressed }) => [styles.slim, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`준비물 ${packedCount} / ${packing.length}`}>
                <Icon name="bag-check-outline" size={18} color={colors.accent} />
                <Text style={styles.slimLabel}>준비물</Text>
                <View style={styles.slimTrack}>
                  <View style={[styles.slimFill, { width: `${Math.round(packRatio * 100)}%` }]} />
                </View>
                <Text style={styles.slimValue}>
                  {packedCount}/{packing.length}
                </Text>
              </Pressable>
            ) : null}

            {trip && !packing.length ? (
              <Pressable onPress={goPacking} style={({ pressed }) => [styles.slim, pressed && styles.pressed]} accessibilityRole="button">
                <Icon name="bag-add-outline" size={18} color={colors.accent} />
                <Text style={styles.slimLabel}>준비물 채우기</Text>
                <View style={styles.flex1} />
                <Text style={styles.slimHint}>기본 21개</Text>
                <Icon name="chevron-forward" size={14} color={colors.faint} />
              </Pressable>
            ) : null}

            {/* ───────── 빠른 실행 ───────── */}
            <View style={styles.block}>
              <SectionHead title="빠른 실행" />
              <View style={styles.grid}>
                {quick.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => navigateHub(navigation, item)}
                    style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <View style={[styles.cellIcon, { backgroundColor: item.tint }]}>
                      <Icon name={item.icon} size={22} color={item.iconColor} />
                    </View>
                    <Text style={styles.cellLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  flex1: { flex: 1 },
  pressed: { opacity: 0.9 },

  heroWrap: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', backgroundColor: colors.navy },
  hero: { paddingBottom: OVERLAP + space.lg },
  heroInner: { flexGrow: 1, justifyContent: 'space-between' },
  // 칩이 두 개여도 항상 한 줄 — 작은 글씨로 줄여 넘치면 이름만 말줄임
  clockRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, minHeight: 26 },
  clockChip: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(16,38,63,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  clockName: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  clockTime: { fontSize: 12, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  clockDiff: { fontSize: 10, fontWeight: '600', color: colors.tram },
  heroBottom: { gap: 4 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.tram },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, fontSize: 28, lineHeight: 35, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  // D-day 배지 — 제목 오른쪽의 작은 알약. 상태(예정·여행 중·완료)가 달라도 같은 크기
  dday: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, paddingVertical: 5, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.tram },
  ddayLive: { backgroundColor: '#fff' },
  ddayDone: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  ddayLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: 'rgba(16,38,63,0.72)' },
  ddayNum: { fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.navy, fontVariant: ['tabular-nums'] },
  ddayTextDone: { color: '#fff' },
  meta: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  metaDay: { fontWeight: '800', color: colors.tram },
  chipScroll: { flexGrow: 0, marginTop: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', maxWidth: 150 },
  chipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chipTextOn: { color: colors.navy },

  body: { gap: space.md, marginTop: -OVERLAP },

  onboard: { gap: space.md, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.float },
  onboardTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  steps: { gap: space.md, marginVertical: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepNumNow: { backgroundColor: colors.accentSoft },
  stepNumText: { fontSize: 14, fontWeight: '800', color: colors.muted },
  stepNumTextNow: { color: colors.accentDark },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  stepSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  onboardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 54, borderRadius: radius.control, backgroundColor: colors.accent },
  onboardBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // 다음 일정 — 한 줄 슬림 카드 (히어로와 겹치므로 배경은 불투명)
  // 다음 일정 — 얇은 한 줄 (시간은 배경 없이 글씨만)
  today: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingVertical: 8, paddingLeft: space.lg, paddingRight: 10, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.float },
  todayMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  todayTimeBox: { justifyContent: 'center' },
  todayTime: { fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  todayPlace: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayPin: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  todayName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  todayGo: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },

  // 안내·요약 — 한 줄짜리 슬림 행
  slim: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  slimLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  slimHint: { fontSize: 12, color: colors.muted },
  slimValue: { fontSize: 13, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  slimTrack: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginHorizontal: space.xs },
  slimFill: { height: '100%', backgroundColor: colors.forest, borderRadius: radius.pill },

  block: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },


  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '25%', alignItems: 'center', gap: 5 },
  cellIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontSize: 12, fontWeight: '600', color: colors.ink },

  // 다녀온 여행
  stats: { flexDirection: 'row', paddingVertical: space.lg, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.float },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.line },
  statNum: { fontSize: 28, lineHeight: 33, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, alignItems: 'center', gap: space.sm, paddingVertical: space.lg, paddingHorizontal: space.sm, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  tileIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  newTrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.accentSoft },
  newTripText: { fontSize: 15, fontWeight: '800', color: colors.accent }
});
