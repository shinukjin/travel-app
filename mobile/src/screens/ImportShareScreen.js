import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sortTripsForHome, useGuide } from '../GuideContext';
import { StackPage } from '../components/StackPage';
import { api } from '../api';
import { APPLY_MODES, PLAN_KIND, PLAN_PARTS, applyPlan, planCounts, reportText } from '../planTransfer';
import { expiryText } from '../shareLink';
import { countryLabels } from '../countries';
import { colors, formatRange, radius, space } from '../theme';
import { Icon } from '../ui';

/** 웹에서는 Alert 버튼이 동작하지 않아 window.confirm 을 쓴다 */
function confirmAction(title, message, onOk, okLabel) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk }
  ]);
}

/** 공유 링크로 받은 계획을 미리 보고, 무엇을 어떻게 적용할지 고른다 */
export default function ImportShareScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const token = params?.token;
  const { trips, trip: currentTrip, refresh, selectTrip } = useGuide();

  const [state, setState] = useState({ status: 'loading', row: null, error: '' });
  const [parts, setParts] = useState({});
  const [mode, setMode] = useState('new');
  const [targetId, setTargetId] = useState(currentTrip?.id ?? null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', row: null, error: '' });
    setResult(null);
    (async () => {
      try {
        const row = await api.getSharedPlan(token);
        if (!active) return;
        if (!row || row.payload?.kind !== PLAN_KIND) {
          setState({ status: 'error', row: null, error: '링크가 만료됐거나 올바르지 않아요. 보낸 사람에게 새 링크를 부탁해 보세요.' });
          return;
        }
        const counts = planCounts(row.payload);
        // 들어 있는 항목은 처음에 모두 선택
        setParts(Object.fromEntries(PLAN_PARTS.map((p) => [p.id, counts[p.id] > 0])));
        setState({ status: 'ready', row, error: '' });
      } catch (e) {
        if (active) setState({ status: 'error', row: null, error: e.message || '링크를 열지 못했어요. 인터넷 연결을 확인해 주세요.' });
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const plan = state.row?.payload;
  const counts = useMemo(() => planCounts(plan), [plan]);
  const orderedTrips = useMemo(() => sortTripsForHome(trips), [trips]);
  const target = trips.find((t) => t.id === targetId);
  const selectedCount = PLAN_PARTS.filter((p) => parts[p.id]).length;
  const canApply = selectedCount > 0 && (mode === 'new' || Boolean(target)) && !applying;

  async function run() {
    setApplying(true);
    try {
      const { tripId, report } = await applyPlan(plan, { parts, mode, targetTripId: mode === 'new' ? null : targetId });
      await refresh();
      selectTrip(tripId);
      setResult({ text: reportText(report) });
    } catch (e) {
      Alert.alert('적용하지 못했어요', e.message || '잠시 뒤 다시 시도해 주세요.');
    } finally {
      setApplying(false);
    }
  }

  function onApply() {
    if (mode === 'replace') {
      const names = PLAN_PARTS.filter((p) => parts[p.id]).map((p) => p.label).join(', ');
      confirmAction(
        '덮어쓸까요?',
        `‘${target?.title}’의 ${names} 기존 내용이 받은 내용으로 교체돼요. 되돌릴 수 없어요.`,
        run,
        '덮어쓰기'
      );
      return;
    }
    run();
  }

  if (state.status === 'loading') {
    return (
      <StackPage title="공유받은 일정" contentStyle={styles.body}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>공유받은 일정을 불러오는 중…</Text>
        </View>
      </StackPage>
    );
  }

  if (state.status === 'error') {
    return (
      <StackPage title="공유받은 일정" contentStyle={styles.body}>
        <View style={styles.errorCard}>
          <Icon name="alert-circle-outline" size={28} color={colors.danger} />
          <Text style={styles.errorTitle}>일정을 열 수 없어요</Text>
          <Text style={styles.errorText}>{state.error}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.ghost} accessibilityRole="button">
            <Text style={styles.ghostText}>돌아가기</Text>
          </Pressable>
        </View>
      </StackPage>
    );
  }

  if (result) {
    return (
      <StackPage title="공유받은 일정" contentStyle={styles.body}>
        <View style={styles.doneCard}>
          <Icon name="checkmark-circle" size={32} color={colors.forest} />
          <Text style={styles.doneTitle}>적용했어요</Text>
          <Text style={styles.doneText}>{result.text}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>확인</Text>
          </Pressable>
        </View>
      </StackPage>
    );
  }

  const summary = [plan.trip.destination || countryLabels(plan.trip.country), formatRange(plan.trip.startDate, plan.trip.endDate)].filter(Boolean).join(' · ');

  return (
    <StackPage title="공유받은 일정" contentStyle={styles.body}>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {plan.trip.title}
        </Text>
        <Text style={styles.summaryMeta}>{summary}</Text>
        <Text style={styles.summaryExpire}>{expiryText(state.row.expires_at)} 열 수 있는 링크예요</Text>
      </View>

      <Text style={styles.sectionTitle}>가져올 항목</Text>
      <View style={styles.group}>
        {PLAN_PARTS.map((p, i) => {
          const count = counts[p.id];
          return (
            <Pressable
              key={p.id}
              disabled={!count}
              onPress={() => setParts((cur) => ({ ...cur, [p.id]: !cur[p.id] }))}
              style={[styles.toggle, i < PLAN_PARTS.length - 1 && styles.toggleLine, !count && styles.dim]}
              accessibilityRole="switch"
              accessibilityState={{ checked: Boolean(parts[p.id]), disabled: !count }}
            >
              <View style={styles.flex1}>
                <Text style={styles.toggleLabel}>{p.label}</Text>
                <Text style={styles.toggleHint}>{count ? `${count}${p.unit}` : '들어 있지 않아요'}</Text>
              </View>
              <Switch
                value={Boolean(parts[p.id])}
                disabled={!count}
                onValueChange={(v) => setParts((cur) => ({ ...cur, [p.id]: v }))}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor="#fff"
                ios_backgroundColor={colors.line}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>적용 방식</Text>
      <View style={styles.modes}>
        {APPLY_MODES.map((m) => {
          const on = m.id === mode;
          const disabled = m.id !== 'new' && !trips.length;
          return (
            <Pressable
              key={m.id}
              disabled={disabled}
              onPress={() => setMode(m.id)}
              style={[styles.mode, on && styles.modeOn, disabled && styles.dim]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled }}
            >
              <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.flex1}>
                <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>{m.label}</Text>
                <Text style={styles.modeHint}>{m.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {mode !== 'new' ? (
        <>
          <Text style={styles.sectionTitle}>적용할 내 여행</Text>
          <View style={styles.group}>
            {orderedTrips.map((t, i) => {
              const on = t.id === targetId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTargetId(t.id)}
                  style={[styles.tripRow, i < orderedTrips.length - 1 && styles.toggleLine, on && styles.tripRowOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={styles.flex1}>
                    <Text style={styles.toggleLabel} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.toggleHint} numberOfLines={1}>
                      {formatRange(t.startDate, t.endDate)}
                    </Text>
                  </View>
                  {on ? <Icon name="checkmark-circle" size={20} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
          {mode === 'replace' ? <Text style={styles.warn}>덮어쓰면 선택한 항목의 기존 내용이 사라져요.</Text> : null}
        </>
      ) : null}

      <Pressable
        onPress={onApply}
        disabled={!canApply}
        style={[styles.primary, mode === 'replace' && styles.primaryDanger, !canApply && styles.disabled]}
        accessibilityRole="button"
      >
        {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === 'replace' ? '덮어쓰기' : mode === 'merge' ? '합치기' : '새 여행으로 추가'}</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.goBack()} style={styles.ghost} accessibilityRole="button">
        <Text style={styles.ghostText}>적용하지 않고 닫기</Text>
      </Pressable>
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  flex1: { flex: 1 },
  center: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  muted: { fontSize: 14, color: colors.muted },
  dim: { opacity: 0.45 },
  disabled: { opacity: 0.45 },
  summary: { gap: 4, padding: space.lg, borderRadius: radius.sheet, backgroundColor: colors.accentSoft },
  summaryTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  summaryMeta: { fontSize: 13, color: colors.muted },
  summaryExpire: { fontSize: 12, fontWeight: '700', color: colors.accentDark, marginTop: space.xs },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: -0.3, marginTop: space.sm },
  group: { borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  toggleLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  toggleHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  modes: { gap: space.sm },
  mode: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
  modeOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  modeLabelOn: { color: colors.accentDark },
  modeHint: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  tripRowOn: { backgroundColor: colors.accentSoft },
  warn: { fontSize: 13, fontWeight: '600', color: colors.danger },
  primary: { height: 54, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  primaryDanger: { backgroundColor: colors.danger },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  ghost: { height: 46, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  errorCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  errorTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  errorText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  doneCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  doneTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  doneText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21 }
});
