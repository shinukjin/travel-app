import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuide } from '../GuideContext';
import { navigatePlaceInfo } from '../placeInfo';
import { navigateHub, quickActions, TAB_ROUTES } from '../tools';
import { TAB_BAR_BASE, categoryMeta, colors, formatRange, formatTime, radius, shadow, space, type } from '../theme';
import { countryLabels } from '../countries';
import { useLayout } from '../layout';
import { HeroArt } from '../components/HeroArt';
import { Icon } from '../ui';

const DAY_MS = 86400000;
const OVERLAP = 44;

/** 여행 상태: D-3 / 2일차 / 여행 완료 */
function tripBadge(trip) {
  if (!trip?.startDate || !trip?.endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T00:00:00`);
  if (today < start) return { text: `D-${Math.round((start - today) / DAY_MS)}`, label: '출발까지', live: false };
  if (today > end) return { text: '완료', label: '다녀온 여행', live: false };
  return { text: `${Math.round((today - start) / DAY_MS) + 1}일차`, label: '여행 중', live: true };
}

function greeting(live) {
  const h = new Date().getHours();
  if (live) return h < 12 ? '좋은 아침, 오늘도 즐거운 여행이에요' : h < 18 ? '오늘 하루도 반짝이길 바라요' : '근사한 저녁 보내세요';
  if (h >= 5 && h < 11) return '좋은 아침이에요';
  if (h >= 11 && h < 17) return '즐거운 오후예요';
  if (h >= 17 && h < 22) return '좋은 저녁이에요';
  return '편안한 밤이에요';
}

function SectionHead({ title, action, onAction }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { trip, trips, tripId, days, loading, offline, selectTrip, nextStop, packedCount, packing, todayDay } = useGuide();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const badge = tripBadge(trip);
  const eyebrow = trip ? [countryLabels(trip.country), offline ? '오프라인' : null].filter(Boolean).join(' · ') : '';
  const meta = trip ? [trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ') : '';
  const packRatio = packing.length ? packedCount / packing.length : 0;
  const items = (todayDay?.items || []).slice(0, 4);
  const scheduledCount = (days || []).reduce((sum, d) => sum + (d.items?.length || 0), 0);
  const frame =
    layout.width > layout.contentMaxWidth ? { maxWidth: layout.contentMaxWidth, width: '100%', alignSelf: 'center' } : null;

  const goNewTrip = () =>
    navigation.navigate('Tabs', { screen: TAB_ROUTES.tools, params: { section: 'settings', newTrip: Date.now() } });
  const goSchedule = () => navigation.navigate('Tabs', { screen: TAB_ROUTES.travel, params: { section: 'schedule' } });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: TAB_BAR_BASE + insets.bottom + space.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ───────── 히어로 ───────── */}
      <View style={styles.heroWrap}>
        <HeroArt style={[styles.hero, { paddingTop: Math.max(insets.top, space.md) + space.md }]}>
          <View style={[styles.heroInner, frame, { paddingHorizontal: layout.gutter }]}>
            <View style={styles.heroTop}>
              <Text style={styles.greeting} numberOfLines={1}>
                {greeting(badge?.live)}
              </Text>
              {badge ? (
                <View style={[styles.badge, badge.live && styles.badgeLive]}>
                  <Text style={[styles.badgeText, badge.live && styles.badgeTextLive]}>{badge.text}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.heroBottom}>
              {trip ? (
                <>
                  <Text style={styles.eyebrow}>{eyebrow}</Text>
                  <Text style={styles.title} numberOfLines={2}>
                    {trip.title}
                  </Text>
                  {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                  {trips.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
                      {trips.map((t) => {
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

        {/* ───────── 다음 장소 티켓 (히어로와 겹치게) ───────── */}
        {nextStop ? (
          <Pressable
            style={({ pressed }) => [styles.ticket, pressed && styles.pressed]}
            onPress={() => navigatePlaceInfo(navigation, nextStop.place, nextStop.note)}
            accessibilityRole="button"
            accessibilityLabel={`다음 장소 ${nextStop.place?.name}`}
          >
            <View style={styles.ticketMain}>
              <Text style={styles.ticketLabel}>다음 장소{todayDay ? ` · ${todayDay.dayIndex}일차` : ''}</Text>
              <Text style={styles.ticketName} numberOfLines={2}>
                {nextStop.place?.name}
              </Text>
              <View style={styles.ticketGo}>
                <Icon name="navigate" size={14} color={colors.navy} />
                <Text style={styles.ticketGoText}>상세 보기</Text>
              </View>
            </View>
            <View style={styles.perforation}>
              <View style={[styles.notch, styles.notchTop]} />
              <View style={styles.perfLine} />
              <View style={[styles.notch, styles.notchBottom]} />
            </View>
            <View style={styles.ticketStub}>
              <Text style={styles.stubLabel}>시작</Text>
              <Text style={styles.stubTime}>{formatTime(nextStop.startTime)}</Text>
            </View>
          </Pressable>
        ) : null}

        {trip && !scheduledCount ? (
          <Pressable onPress={goSchedule} style={({ pressed }) => [styles.nudge, pressed && styles.pressed]} accessibilityRole="button">
            <View style={styles.nudgeIcon}>
              <Icon name="calendar" size={20} color={colors.navy} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.nudgeTitle}>일정을 등록해 보세요</Text>
              <Text style={styles.nudgeSub}>일차별로 장소를 담으면 지도와 오늘 일정에 바로 나타나요</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.navy} />
          </Pressable>
        ) : null}

        {/* ───────── 오늘 일정 ───────── */}
        {items.length ? (
          <View style={styles.block}>
            <SectionHead title="오늘 일정" action="전체 보기" onAction={goSchedule} />
            <View style={styles.listCard}>
              {items.map((item, index) => {
                const cat = categoryMeta[item.place?.category] || categoryMeta.SIGHT;
                const last = index === items.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => navigatePlaceInfo(navigation, item.place, item.note)}
                    style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.rowTime}>{formatTime(item.startTime)}</Text>
                    <View style={[styles.rowIcon, { backgroundColor: cat.soft }]}>
                      <Icon name={cat.icon} size={16} color={cat.color} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item.place?.name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {item.note || cat.label}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color={colors.faint} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ───────── 준비물 ───────── */}
        {packing.length ? (
          <Pressable
            onPress={() => navigation.navigate('Tabs', { screen: TAB_ROUTES.travel, params: { section: 'packing' } })}
            style={({ pressed }) => [styles.pack, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="준비물"
          >
            <View style={styles.packHead}>
              <Text style={styles.sectionTitle}>준비물</Text>
              <Text style={styles.packValue}>
                {packedCount}
                <Text style={styles.packTotal}> / {packing.length}</Text>
              </Text>
            </View>
            <View style={styles.packTrack}>
              <View style={[styles.packFill, { width: `${Math.round(packRatio * 100)}%` }]} />
            </View>
          </Pressable>
        ) : null}

        {/* ───────── 빠른 실행 ───────── */}
        <View style={styles.block}>
          <SectionHead title="빠른 실행" />
          <View style={styles.grid}>
            {quickActions().map((item) => (
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
      </View>
    </ScrollView>
  );
}

const NOTCH = 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  flex1: { flex: 1 },
  pressed: { opacity: 0.9 },

  heroWrap: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', backgroundColor: colors.navy },
  hero: { minHeight: 300, paddingBottom: OVERLAP + space.xl, justifyContent: 'space-between' },
  heroInner: { flex: 1, justifyContent: 'space-between', gap: space.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  greeting: { flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  badgeLive: { backgroundColor: colors.tram, borderColor: colors.tram },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  badgeTextLive: { color: colors.navy },
  heroBottom: { gap: 4 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: colors.tram },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  meta: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  chipScroll: { flexGrow: 0, marginTop: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', maxWidth: 150 },
  chipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chipTextOn: { color: colors.navy },

  body: { gap: space.xl, marginTop: -OVERLAP },

  onboard: { gap: space.md, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.float },
  onboardTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  steps: { gap: space.md, marginVertical: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepNumNow: { backgroundColor: colors.navy },
  stepNumText: { fontSize: 14, fontWeight: '800', color: colors.muted },
  stepNumTextNow: { color: colors.tram },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  stepSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  onboardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 54, borderRadius: radius.control, backgroundColor: colors.accent },
  onboardBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  ticket: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.navy, borderRadius: radius.sheet, minHeight: 132, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', ...shadow.float },
  ticketMain: { flex: 1, padding: space.lg, gap: space.sm, justifyContent: 'space-between' },
  ticketLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.62)' },
  ticketName: { fontSize: 22, lineHeight: 29, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  ticketGo: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.tram, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: space.md },
  ticketGoText: { fontSize: 12, fontWeight: '800', color: colors.navy },
  perforation: { width: 1, alignItems: 'center', justifyContent: 'center' },
  perfLine: { flex: 1, width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderLeftColor: 'rgba(255,255,255,0.28)', marginVertical: NOTCH / 2 + 4 },
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.bg },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  ticketStub: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.sm },
  stubLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.62)' },
  stubTime: { fontSize: 26, fontWeight: '800', color: colors.tram, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },

  nudge: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.tramSoft, borderWidth: 1, borderColor: colors.tram },
  nudgeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.tram, alignItems: 'center', justifyContent: 'center' },
  nudgeTitle: { fontSize: 15, fontWeight: '800', color: colors.navy },
  nudgeSub: { fontSize: 12, color: '#7A4F00', marginTop: 2, lineHeight: 17 },

  block: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  sectionAction: { fontSize: 13, fontWeight: '600', color: colors.muted },
  listCard: { backgroundColor: colors.card, borderRadius: radius.sheet, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowPressed: { backgroundColor: colors.surfaceTint },
  rowTime: { width: 44, fontSize: 14, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'] },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.muted },

  pack: { gap: space.md, padding: space.lg, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  packHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  packValue: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  packTotal: { fontSize: 14, fontWeight: '600', color: colors.muted },
  packTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  packFill: { height: '100%', backgroundColor: colors.forest, borderRadius: radius.pill },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  cell: { width: '25%', alignItems: 'center', gap: 8 },
  cellIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontSize: 13, fontWeight: '600', color: colors.ink }
});
