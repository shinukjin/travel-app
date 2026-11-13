import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useGuide } from '../GuideContext';
import { StackPage } from '../components/StackPage';
import { api } from '../api';
import { colors, packingMeta, radius, space } from '../theme';
import { Icon, TripLabel } from '../ui';
import { useToast } from '../Toast';

/** 해외여행 기본 준비물 — 이미 있는 이름은 건너뛰고 추가한다 */
const TEMPLATE = [
  ['DOCS', '여권'],
  ['DOCS', '항공권·e티켓'],
  ['DOCS', '여행자 보험 증서'],
  ['DOCS', '숙소·티켓 바우처'],
  ['DOCS', '신용·체크카드'],
  ['DOCS', '현금(현지 통화)'],
  ['GEAR', '휴대폰 충전기'],
  ['GEAR', '멀티 어댑터'],
  ['GEAR', '보조배터리'],
  ['GEAR', '이어폰'],
  ['CLOTHES', '속옷·양말'],
  ['CLOTHES', '편한 신발'],
  ['CLOTHES', '겉옷'],
  ['CLOTHES', '잠옷'],
  ['TOILETRY', '칫솔·치약'],
  ['TOILETRY', '화장품'],
  ['TOILETRY', '선크림'],
  ['MEDICINE', '상비약'],
  ['MEDICINE', '개인 처방약'],
  ['OTHER', '접이식 우산'],
  ['OTHER', '캐리어 자물쇠']
];

export default function PackingScreen({ embed }) {
  const toast = useToast();
  const { trip, trips, tripId, packing, loading, selectTrip, setPackingForTrip } = useGuide();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('DOCS');
  const [openOnly, setOpenOnly] = useState(false);
  const [manage, setManage] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [filling, setFilling] = useState(false);

  const packedCount = packing.filter((item) => item.packed).length;
  const total = packing.length;
  const percent = total ? Math.round((packedCount / total) * 100) : 0;
  const allDone = total > 0 && packedCount === total;

  const groups = useMemo(
    () =>
      Object.entries(packingMeta)
        .map(([id, meta]) => {
          const rows = packing
            .filter((item) => item.category === id && (!openOnly || !item.packed))
            .sort((a, b) => Number(a.packed) - Number(b.packed) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          return { id, meta, rows, done: packing.filter((i) => i.category === id && i.packed).length, count: packing.filter((i) => i.category === id).length };
        })
        .filter((g) => g.rows.length),
    [packing, openOnly]
  );

  async function toggle(item) {
    const next = { ...item, packed: !item.packed };
    setPackingForTrip(packing.map((row) => (row.id === item.id ? next : row)));
    try {
      await api.updatePacking(item.id, next);
    } catch {
      /* 오프라인: 화면에는 먼저 반영 */
    }
  }

  async function changeQty(item, delta) {
    const quantity = Math.max(1, (item.quantity || 1) + delta);
    if (quantity === (item.quantity || 1)) return;
    const next = { ...item, quantity };
    setPackingForTrip(packing.map((row) => (row.id === item.id ? next : row)));
    try {
      await api.updatePacking(item.id, next);
    } catch {
      /* 오프라인 */
    }
  }

  async function add() {
    const n = name.trim();
    if (!n || !trip) return;
    try {
      const created = await api.createPacking({
        tripId: trip.id,
        name: n,
        category,
        quantity: 1,
        note: '',
        packed: false,
        sortOrder: packing.length
      });
      setPackingForTrip([...packing, created]);
      setName('');
      toast.show('준비물을 추가했어요');
    } catch (error) {
      Alert.alert('저장 실패', error.message);
    }
  }

  function confirmRemove(item) {
    Alert.alert(`'${item.name}' 삭제`, '목록에서 지울까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setPackingForTrip(packing.filter((row) => row.id !== item.id));
          try {
            await api.deletePacking(item.id);
          } catch {
            /* 오프라인 */
          }
        }
      }
    ]);
  }

  async function fillTemplate() {
    if (!trip || filling) return;
    const have = new Set(packing.map((p) => p.name.trim()));
    const missing = TEMPLATE.filter(([, n]) => !have.has(n));
    if (!missing.length) {
      Alert.alert('이미 모두 들어 있어요', '기본 준비물이 전부 목록에 있습니다.');
      return;
    }
    setFilling(true);
    try {
      const created = [];
      for (const [cat, n] of missing) {
        const row = await api.createPacking({
          tripId: trip.id,
          name: n,
          category: cat,
          quantity: 1,
          note: '',
          packed: false,
          sortOrder: packing.length + created.length
        });
        created.push(row);
      }
      setPackingForTrip([...packing, ...created]);
    } catch (error) {
      Alert.alert('추가 실패', error.message);
    } finally {
      setFilling(false);
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
    <StackPage title="준비" contentStyle={styles.body} embed={embed}>
      <TripLabel trip={trip} />

      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>{allDone ? '준비 완료' : '챙긴 물건'}</Text>
            <Text style={styles.summaryCount}>
              {packedCount}
              <Text style={styles.summaryTotal}> / {total}</Text>
            </Text>
          </View>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }, allDone && styles.fillDone]} />
        </View>
        <View style={styles.summaryBottom}>
          <View style={styles.seg}>
            <Pressable onPress={() => setOpenOnly(false)} style={[styles.segItem, !openOnly && styles.segOn]}>
              <Text style={[styles.segText, !openOnly && styles.segTextOn]}>전체</Text>
            </Pressable>
            <Pressable onPress={() => setOpenOnly(true)} style={[styles.segItem, openOnly && styles.segOn]}>
              <Text style={[styles.segText, openOnly && styles.segTextOn]}>남은 것 {Math.max(total - packedCount, 0)}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setManage((v) => !v)} style={[styles.manageBtn, manage && styles.manageOn]} accessibilityRole="button" accessibilityState={{ selected: manage }}>
            <Icon name="options-outline" size={15} color={colors.forestInk} />
            <Text style={[styles.manageText, manage && styles.manageTextOn]}>{manage ? '완료' : '정리'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.addCard}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={name}
            onChangeText={setName}
            placeholder="챙길 물건 추가"
            placeholderTextColor={colors.faint}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <Pressable onPress={add} style={[styles.addBtn, !name.trim() && styles.disabled]} disabled={!name.trim()} accessibilityRole="button" accessibilityLabel="준비물 추가">
            <Icon name="add" size={22} color="#fff" />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          {Object.entries(packingMeta).map(([id, meta]) => {
            const on = id === category;
            return (
              <Pressable key={id} onPress={() => setCategory(id)} style={[styles.cat, on && styles.catOn]} accessibilityState={{ selected: on }}>
                <Icon name={meta.icon} size={14} color={on ? colors.forestInk : colors.muted} />
                <Text style={[styles.catText, on && styles.catTextOn]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!total ? (
        <View style={styles.emptyCard}>
          <Icon name="bag-check-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>준비물 목록을 만들어 볼까요?</Text>
          <Text style={styles.emptyText}>해외여행 기본 준비물 {TEMPLATE.length}개를 한 번에 채울 수 있어요. 나중에 자유롭게 빼고 더할 수 있어요.</Text>
          <Pressable onPress={fillTemplate} disabled={filling || !trip} style={[styles.fillBtn, (filling || !trip) && styles.disabled]} accessibilityRole="button">
            {filling ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="sparkles" size={16} color="#fff" />}
            <Text style={styles.fillBtnText}>{filling ? '채우는 중…' : '기본 준비물 채우기'}</Text>
          </Pressable>
        </View>
      ) : null}

      {groups.map(({ id, meta, rows, done, count }) => {
        // 다 챙긴 분류는 처음부터 접어 두고, 눌러서 다시 펼 수 있다
        const closed = collapsed[id] ?? (count > 0 && done === count && !openOnly);
        return (
          <View key={id} style={styles.group}>
            <Pressable style={styles.groupHead} onPress={() => setCollapsed((c) => ({ ...c, [id]: !closed }))} accessibilityRole="button" accessibilityState={{ expanded: !closed }}>
              <View style={styles.groupIcon}>
                <Icon name={meta.icon} size={16} color={colors.accentDark} />
              </View>
              <Text style={styles.groupTitle}>{meta.label}</Text>
              <Text style={[styles.groupCount, done === count && styles.groupCountDone]}>
                {done}/{count}
              </Text>
              <Icon name={closed ? 'chevron-down' : 'chevron-up'} size={16} color={colors.faint} />
            </Pressable>
            {closed
              ? null
              : rows.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => (manage ? null : toggle(item))}
                    onLongPress={() => confirmRemove(item)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!item.packed }}
                  >
                    <View style={[styles.check, item.packed && styles.checkOn]}>
                      {item.packed ? <Icon name="checkmark" size={13} color="#fff" /> : null}
                    </View>
                    <Text style={[styles.itemName, item.packed && styles.itemDone]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {manage ? (
                      <View style={styles.manageRow}>
                        <Pressable onPress={() => changeQty(item, -1)} hitSlop={6} style={styles.qtyBtn} accessibilityLabel="수량 줄이기">
                          <Icon name="remove" size={16} color={colors.ink} />
                        </Pressable>
                        <Text style={styles.qty}>{item.quantity || 1}</Text>
                        <Pressable onPress={() => changeQty(item, 1)} hitSlop={6} style={styles.qtyBtn} accessibilityLabel="수량 늘리기">
                          <Icon name="add" size={16} color={colors.ink} />
                        </Pressable>
                        <Pressable onPress={() => confirmRemove(item)} hitSlop={6} style={styles.trash} accessibilityLabel="삭제">
                          <Icon name="trash-outline" size={18} color={colors.danger} />
                        </Pressable>
                      </View>
                    ) : (item.quantity || 1) > 1 ? (
                      <Text style={styles.qtyBadge}>×{item.quantity}</Text>
                    ) : null}
                  </Pressable>
                ))}
          </View>
        );
      })}

      {total && openOnly && !groups.length ? (
        <View style={styles.emptyCard}>
          <Icon name="checkmark-circle" size={28} color={colors.forest} />
          <Text style={styles.emptyTitle}>모두 챙겼어요!</Text>
        </View>
      ) : null}

      {total ? (
        <Pressable onPress={fillTemplate} disabled={filling} style={styles.moreBtn} accessibilityRole="button">
          <Icon name="sparkles-outline" size={16} color={colors.muted} />
          <Text style={styles.moreText}>{filling ? '채우는 중…' : '빠진 기본 준비물 채우기'}</Text>
        </Pressable>
      ) : null}
      {total && !manage ? <Text style={styles.tip}>항목을 길게 누르면 삭제할 수 있어요.</Text> : null}
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  disabled: { opacity: 0.4 },
  // 요약 — 작은 숫자 한 줄 + 진행 막대 + 보기 전환
  // 요약 — 연한 민트 바탕 + 같은 계열의 진한 글씨 (꽉 찬 색 대신)
  summary: { gap: space.sm, padding: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: colors.forestSoft },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: colors.forestInk },
  summaryCount: { fontSize: 22, fontWeight: '800', color: colors.forestInk, letterSpacing: -0.5 },
  summaryTotal: { fontSize: 14, fontWeight: '600', color: colors.forestInk },
  percent: { fontSize: 16, fontWeight: '800', color: colors.forestInk },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(47,143,107,0.22)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.forest, borderRadius: 3 },
  fillDone: { backgroundColor: colors.forest },
  summaryBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seg: { flexDirection: 'row', padding: 2, borderRadius: radius.pill, backgroundColor: 'rgba(47,143,107,0.14)' },
  segItem: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill },
  segOn: { backgroundColor: '#fff' },
  segText: { fontSize: 12, fontWeight: '700', color: colors.forestInk },
  segTextOn: { color: colors.forestInk },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff' },
  manageOn: { backgroundColor: '#B7E0CE' },
  manageText: { fontSize: 12, fontWeight: '700', color: colors.forestInk },
  manageTextOn: { color: colors.forestInk },
  addCard: { gap: space.sm, padding: space.sm, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  addRow: { flexDirection: 'row', gap: space.sm },
  addInput: { flex: 1, height: 42, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, fontSize: 14, color: colors.ink },
  addBtn: { width: 42, height: 42, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  cats: { gap: 6, paddingRight: space.md },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  catOn: { backgroundColor: '#CBEADB' },
  catText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  catTextOn: { color: colors.forestInk },
  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  fillBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.sm, paddingHorizontal: space.xl, height: 44, borderRadius: radius.pill, backgroundColor: colors.accent },
  fillBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  group: { borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, paddingHorizontal: space.lg },
  groupIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.ink },
  groupCount: { fontSize: 12, fontWeight: '700', color: colors.muted },
  groupCountDone: { color: colors.forest },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, paddingVertical: 8, paddingHorizontal: space.lg, borderTopWidth: 1, borderTopColor: colors.lineHair },
  rowPressed: { backgroundColor: colors.surfaceTint },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  itemDone: { color: colors.faint, textDecorationLine: 'line-through', fontWeight: '500' },
  qtyBadge: { fontSize: 12, fontWeight: '700', color: colors.muted },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 18, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.ink },
  trash: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44 },
  moreText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  tip: { textAlign: 'center', fontSize: 12, color: colors.faint }
});
