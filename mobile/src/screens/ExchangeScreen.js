import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useFocusEffect } from '@react-navigation/native';
import { StackPage } from '../components/StackPage';
import {
  convertAmount,
  formatNumberInput,
  loadFxRates,
  parseNumberInput,
  refreshFxRates,
  saveManualRates
} from '../fx';
import { colors, radius, shadow, space, type } from '../theme';
import { Icon } from '../ui';

const CURRENCIES = ['KRW', 'EUR', 'USD'];
const CURRENCY_NAMES = { KRW: '원', EUR: '유로', USD: '달러' };
const CURRENCY_SYMBOLS = { KRW: '₩', EUR: '€', USD: '$' };

export default function ExchangeScreen({ embed }) {
  const [rates, setRates] = useState(null);
  const [from, setFrom] = useState('EUR');
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [eurInput, setEurInput] = useState('');
  const [usdInput, setUsdInput] = useState('');

  /** 화면 진입 시 자동 갱신 — 수동 설정한 환율은 덮어쓰지 않는다 */
  const load = useCallback(async () => {
    const cached = await loadFxRates();
    setRates(cached);
    setLoading(false);
    if (cached.manual) return;
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

  const openEditor = () => {
    setEurInput(formatNumberInput(String(Math.round(rates.EUR_KRW * 100) / 100)));
    setUsdInput(formatNumberInput(String(Math.round(rates.USD_KRW * 100) / 100)));
    setNotice('');
    setEditing(true);
  };

  const saveEditor = async () => {
    try {
      const saved = await saveManualRates(parseNumberInput(eurInput), parseNumberInput(usdInput));
      setRates(saved);
      setStale(false);
      setEditing(false);
      setNotice('직접 입력한 환율을 저장했어요');
    } catch (e) {
      setNotice(e.message);
    }
  };

  const results = rates
    ? CURRENCIES.filter((c) => c !== from).map((to) => ({
        to,
        value: convertAmount(parseNumberInput(amount), from, to, rates)
      }))
    : [];

  if (loading || !rates) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const status = rates.manual
    ? `직접 입력 · ${rates.updatedAt}`
    : stale
      ? `저장된 환율 사용 중${rates.updatedAt ? ` · 기준 ${rates.updatedAt}` : ''}`
      : rates.updatedAt
        ? `기준 ${rates.updatedAt}`
        : '기본 환율 (갱신 전)';

  return (
    <StackPage title="환율" contentStyle={styles.body} embed={embed}>
      <View style={styles.card}>
        <View style={styles.rateTop}>
          <View style={styles.rateHead}>
            <Text style={styles.rateLine}>
              1 EUR ≈ {Math.round(rates.EUR_KRW).toLocaleString()}원 · 1 USD ≈ {Math.round(rates.USD_KRW).toLocaleString()}원
            </Text>
            <Text style={[styles.status, (stale || rates.manual) && styles.statusAccent]}>{status}</Text>
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

        {editing ? (
          <View style={styles.editor}>
            <View style={styles.editRow}>
              <Text style={styles.editLabel}>1 EUR =</Text>
              <TextInput
                style={styles.editInput}
                value={eurInput}
                onChangeText={(t) => setEurInput(formatNumberInput(t))}
                keyboardType="decimal-pad"
                placeholder="원"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.editUnit}>원</Text>
            </View>
            <View style={styles.editRow}>
              <Text style={styles.editLabel}>1 USD =</Text>
              <TextInput
                style={styles.editInput}
                value={usdInput}
                onChangeText={(t) => setUsdInput(formatNumberInput(t))}
                keyboardType="decimal-pad"
                placeholder="원"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.editUnit}>원</Text>
            </View>
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

        <View style={styles.row}>
          {CURRENCIES.map((cur) => (
            <Pressable
              key={cur}
              onPress={() => setFrom(cur)}
              style={[styles.curPill, from === cur && styles.curPillOn]}
            >
              <Text style={[styles.curText, from === cur && styles.curTextOn]}>{cur}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.unitRow}>
          <Text style={styles.unitLabel}>입력 통화</Text>
          <Text style={styles.unitValue}>
            {CURRENCY_NAMES[from]} ({from}) · {CURRENCY_SYMBOLS[from]}
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
          <Text style={styles.resultLabel}>{row.to}</Text>
          <Text style={styles.resultValue}>
            {row.to === 'KRW' ? Math.round(row.value).toLocaleString() : row.value.toFixed(2)}
          </Text>
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
  notice: { fontSize: 13, fontWeight: '600', color: colors.accent },
  editor: { gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceTint },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  editLabel: { width: 64, fontSize: 14, fontWeight: '700', color: colors.ink },
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
  row: { flexDirection: 'row', gap: space.xs, backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4 },
  curPill: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
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
  resultValue: { fontSize: 22, fontWeight: '800', color: colors.ink }
});
