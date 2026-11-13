import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useFocusEffect } from '@react-navigation/native';
import { StackPage } from '../components/StackPage';
import { useGuide } from '../GuideContext';
import { currenciesForTrip, currencyName } from '../countryInfo';
import {
  convertAmount,
  formatAmount,
  formatNumberInput,
  hasRate,
  krwPer,
  loadFxRates,
  parseNumberInput,
  refreshFxRates,
  saveManualRates
} from '../fx';
import { colors, radius, shadow, space, type } from '../theme';
import { Icon } from '../ui';

export default function ExchangeScreen({ embed }) {
  const { trip } = useGuide();
  const [rates, setRates] = useState(null);
  const [fromPick, setFromPick] = useState(null);
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [inputs, setInputs] = useState({});

  // 안내 문구는 잠깐 보여 준 뒤 저절로 사라지게 한다
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  /** 여행 국가의 현지 통화 → 원·달러와 함께 보여 줄 통화 목록 */
  const locals = useMemo(() => currenciesForTrip(trip).filter((c) => c !== 'KRW'), [trip]);
  const candidates = useMemo(() => [...new Set(['KRW', ...locals, 'USD'])], [locals]);
  const currencies = rates ? candidates.filter((c) => hasRate(c, rates)) : candidates;
  const missing = rates ? locals.filter((c) => !hasRate(c, rates)) : [];
  const from = currencies.includes(fromPick) ? fromPick : locals.find((c) => currencies.includes(c)) || 'USD';

  /** 화면 진입 시 자동 갱신 — 수동 설정한 환율은 덮어쓰지 않는다 */
  const load = useCallback(async () => {
    const cached = await loadFxRates();
    setRates(cached);
    setLoading(false);
    if (cached.manual && Object.keys(cached.manual).length) return;
    try {
      const fresh = await refreshFxRates();
      setRates(fresh);
      setStale(false);
    } catch {
      setStale(true);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  /** 수동 갱신 버튼 — 수동 설정을 해제하고 최신 환율을 받아온다 */
  const refreshNow = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setNotice('');
    try {
      const fresh = await refreshFxRates();
      setRates(fresh);
      setStale(false);
      setEditing(false);
      setNotice('최신 환율로 갱신했어요');
    } catch {
      setNotice('갱신에 실패했어요. 네트워크를 확인하거나 직접 입력해 보세요');
    } finally {
      setRefreshing(false);
    }
  };

  /** 직접 입력할 수 있는 통화 — 원을 뺀 모든 표시 후보 (환율을 못 가져온 통화 포함) */
  const editable = candidates.filter((c) => c !== 'KRW');

  const openEditor = () => {
    const next = {};
    for (const cur of editable) {
      const krw = krwPer(cur, rates);
      next[cur] = krw ? formatNumberInput(String(Math.round(krw * 100) / 100)) : '';
    }
    setInputs(next);
    setNotice('');
    setEditing(true);
  };

  const saveEditor = async () => {
    try {
      const entries = {};
      for (const [cur, text] of Object.entries(inputs)) if (parseNumberInput(text)) entries[cur] = parseNumberInput(text);
      const saved = await saveManualRates(entries, rates);
      setRates(saved);
      setStale(false);
      setEditing(false);
      setNotice('직접 입력한 환율을 저장했어요');
    } catch (e) {
      setNotice(e.message);
    }
  };

  if (loading || !rates) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const manual = rates.manual && Object.keys(rates.manual).length > 0;
  const results = currencies
    .filter((c) => c !== from)
    .map((to) => ({ to, value: convertAmount(parseNumberInput(amount), from, to, rates) }));

  const status = manual
    ? `직접 입력 · ${rates.updatedAt}`
    : stale
      ? `저장된 환율 사용 중${rates.updatedAt ? ` · 기준 ${rates.updatedAt}` : ''}`
      : rates.updatedAt
        ? `기준 ${rates.updatedAt}`
        : '기본 환율 (갱신 전)';

  // 헤더에는 원화 기준으로 현지 통화 환율을 보여 준다 (예: 1 JPY ≈ 8원)
  const headline = currencies
    .filter((c) => c !== 'KRW')
    .slice(0, 3)
    .map((c) => {
      const krw = krwPer(c, rates);
      return `1 ${c} ≈ ${krw >= 100 ? Math.round(krw).toLocaleString() : krw.toFixed(2)}원`;
    })
    .join(' · ');

  return (
    <StackPage title="환율" contentStyle={styles.body} embed={embed}>
      <View style={styles.card}>
        <View style={styles.rateTop}>
          <View style={styles.rateHead}>
            <Text style={styles.rateLine}>{headline}</Text>
            <Text style={[styles.status, (stale || manual) && styles.statusAccent]}>{status}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.iconBtn}
              onPress={openEditor}
              accessibilityRole="button"
              accessibilityLabel="환율 직접 입력"
            >
              <Icon name="create-outline" size={18} color={colors.ink} />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, styles.iconBtnPrimary]}
              onPress={refreshNow}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel="환율 갱신"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="refresh" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {missing.length ? (
          <Text style={styles.notice}>
            {missing.map((c) => `${currencyName(c)}(${c})`).join(', ')} 환율은 가져오지 못했어요. 연필 버튼으로 직접 입력할 수 있어요.
          </Text>
        ) : null}

        {editing ? (
          <View style={styles.editor}>
            {editable.map((cur) => (
              <View key={cur} style={styles.editRow}>
                <Text style={styles.editLabel}>1 {cur} =</Text>
                <TextInput
                  style={styles.editInput}
                  value={inputs[cur] ?? ''}
                  onChangeText={(t) => setInputs((prev) => ({ ...prev, [cur]: formatNumberInput(t) }))}
                  keyboardType="decimal-pad"
                  placeholder="원"
                  placeholderTextColor={colors.faint}
                />
                <Text style={styles.editUnit}>원</Text>
              </View>
            ))}
            <View style={styles.editActions}>
              <Pressable style={styles.btnGhost} onPress={() => setEditing(false)} accessibilityRole="button">
                <Text style={styles.btnGhostText}>취소</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={saveEditor} accessibilityRole="button">
                <Text style={styles.btnPrimaryText}>저장</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.rowScroll}>
          {currencies.map((cur) => (
            <Pressable
              key={cur}
              onPress={() => setFromPick(cur)}
              style={[styles.curPill, from === cur && styles.curPillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: from === cur }}
            >
              <Text style={[styles.curText, from === cur && styles.curTextOn]}>{cur}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.unitRow}>
          <Text style={styles.unitLabel}>입력 통화</Text>
          <Text style={styles.unitValue}>
            {currencyName(from)} ({from})
          </Text>
        </View>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(t) => setAmount(formatNumberInput(t))}
            keyboardType="decimal-pad"
            placeholder="금액"
            placeholderTextColor={colors.faint}
          />
          {amount ? (
            <Pressable
              style={styles.clearBtn}
              onPress={() => setAmount('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="입력한 금액 지우기"
            >
              <Icon name="close-circle" size={24} color={colors.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {results.map((row) => (
        <View key={row.to} style={styles.result}>
          <View>
            <Text style={styles.resultLabel}>{row.to}</Text>
            <Text style={styles.resultName}>{currencyName(row.to)}</Text>
          </View>
          <Text style={styles.resultValue}>{formatAmount(row.value)}</Text>
        </View>
      ))}
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.sheet, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.line },
  rateTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  rateHead: { flex: 1, gap: 4 },
  rateLine: { ...type.meta, color: colors.ink, fontWeight: '600' },
  status: { ...type.caption, fontWeight: '500' },
  statusAccent: { color: colors.accent, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: space.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconBtnPrimary: { backgroundColor: colors.accent },
  notice: { fontSize: 13, fontWeight: '600', color: colors.accent, lineHeight: 19 },
  editor: { gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceTint },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  editLabel: { width: 72, fontSize: 14, fontWeight: '700', color: colors.ink },
  editInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  editUnit: { fontSize: 14, color: colors.muted },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.xs },
  btnGhost: { paddingVertical: 10, paddingHorizontal: space.lg, borderRadius: radius.control, backgroundColor: colors.surfaceMuted },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  btnPrimary: { paddingVertical: 10, paddingHorizontal: space.lg, borderRadius: radius.control, backgroundColor: colors.accent },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  rowScroll: { flexGrow: 0, backgroundColor: colors.surfaceMuted, borderRadius: radius.pill },
  row: { flexGrow: 1, gap: space.xs, padding: 4 },
  curPill: { flexGrow: 1, minWidth: 64, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center' },
  curPillOn: { backgroundColor: colors.card, ...shadow.card },
  curText: { fontWeight: '700', color: colors.muted, fontSize: 13 },
  curTextOn: { color: colors.accent },
  unitRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: -space.sm },
  unitLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  unitValue: { fontSize: 14, fontWeight: '800', color: colors.accent },
  inputWrap: { justifyContent: 'center' },
  input: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'right',
    color: colors.ink,
    paddingVertical: space.md,
    paddingLeft: 48,
    paddingRight: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    letterSpacing: -0.5
  },
  clearBtn: { position: 'absolute', left: space.md, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  result: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sheet,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line
  },
  resultLabel: { ...type.section, color: colors.muted },
  resultName: { fontSize: 12, color: colors.faint, marginTop: 1 },
  resultValue: { fontSize: 22, fontWeight: '800', color: colors.ink }
});
