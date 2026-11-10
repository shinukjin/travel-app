import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useGuide } from '../GuideContext';
import { StackPage } from '../components/StackPage';
import { api } from '../api';
import { copyPlanText } from '../sharePlan';
import { colors, radius, space, voucherMeta } from '../theme';
import { Icon, TripPicker } from '../ui';

const TYPES = ['FLIGHT', 'HOTEL', 'TICKET'];

/** 티켓 종류별 색 */
const TONE = {
  FLIGHT: { color: colors.accent, soft: colors.accentSoft },
  HOTEL: { color: '#6B4FA3', soft: '#E9E3F5' },
  TICKET: { color: '#A56A00', soft: colors.tramSoft }
};

const NOTCH = 16;
const CLAMP_LINES = 4;

function VoucherCard({ voucher, expanded, onToggle }) {
  const type = voucher.type || 'TICKET';
  const meta = voucherMeta[type] || voucherMeta.TICKET;
  const tone = TONE[type] || TONE.TICKET;
  const body = String(voucher.body || '').trim();
  const long = body.length > 110 || body.split('\n').length > CLAMP_LINES;

  return (
    <View style={styles.ticket}>
      <View style={styles.ticketHead}>
        <View style={[styles.typeIcon, { backgroundColor: tone.soft }]}>
          <Icon name={meta.icon} size={20} color={tone.color} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.typeLabel, { color: tone.color }]}>{meta.label}</Text>
          <Text style={styles.ticketTitle} numberOfLines={2}>
            {voucher.title}
          </Text>
        </View>
      </View>

      <View style={styles.perf}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.perfLine} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.ticketBody}>
        {body ? (
          <Text style={styles.bodyText} numberOfLines={expanded || !long ? undefined : CLAMP_LINES} selectable>
            {body}
          </Text>
        ) : (
          <Text style={styles.bodyEmpty}>내용이 없어요</Text>
        )}
        <View style={styles.cardActions}>
          {long ? (
            <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{expanded ? '접기' : '더 보기'}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {body ? (
            <Pressable onPress={() => copyPlanText(`${voucher.title}\n${body}`)} style={styles.copyBtn} accessibilityRole="button" accessibilityLabel="내용 복사·공유">
              <Icon name="copy-outline" size={14} color={colors.muted} />
              <Text style={styles.copyText}>복사·공유</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function VoucherScreen({ embed }) {
  const { trip, trips, tripId, vouchers, loading, selectTrip, refresh } = useGuide();
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState({});
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('FLIGHT');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const c = { ALL: vouchers.length };
    TYPES.forEach((t) => (c[t] = vouchers.filter((v) => (v.type || 'TICKET') === t).length));
    return c;
  }, [vouchers]);

  const rows = vouchers.filter((v) => filter === 'ALL' || (v.type || 'TICKET') === filter);

  async function addVoucher() {
    if (!trip) {
      Alert.alert('여행을 먼저 만드세요.', '도구 → 설정에서 새 여행을 추가할 수 있습니다.');
      return;
    }
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      Alert.alert('제목과 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createVoucher({ tripId: trip.id, title: t, type, body: b });
      setTitle('');
      setBody('');
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
    <StackPage title="티켓" contentStyle={styles.body} embed={embed}>
      {trips.length > 1 ? <TripPicker trips={trips} tripId={tripId} onSelect={selectTrip} /> : null}

      {vouchers.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
          {['ALL', ...TYPES].map((id) => {
            const on = id === filter;
            return (
              <Pressable key={id} onPress={() => setFilter(id)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {id === 'ALL' ? '전체' : voucherMeta[id].label} {counts[id]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {rows.map((voucher) => (
        <VoucherCard
          key={voucher.id}
          voucher={voucher}
          expanded={!!expanded[voucher.id]}
          onToggle={() => setExpanded((e) => ({ ...e, [voucher.id]: !e[voucher.id] }))}
        />
      ))}

      {!vouchers.length ? (
        <View style={styles.emptyCard}>
          <Icon name="ticket-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>예약 정보를 한곳에 모아 두세요</Text>
          <Text style={styles.emptyText}>항공, 호텔, 입장권의 예약번호와 시간을 적어 두면 오프라인에서도 바로 열어 볼 수 있어요.</Text>
        </View>
      ) : null}

      {composing ? (
        <View style={styles.compose}>
          <Text style={styles.composeTitle}>티켓 추가</Text>
          <View style={styles.typeRow}>
            {TYPES.map((id) => {
              const on = type === id;
              const meta = voucherMeta[id];
              return (
                <Pressable key={id} onPress={() => setType(id)} style={[styles.typePill, on && { backgroundColor: TONE[id].color }]} accessibilityState={{ selected: on }}>
                  <Icon name={meta.icon} size={16} color={on ? '#fff' : TONE[id].color} />
                  <Text style={[styles.typeText, on && styles.typeTextOn]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="제목 (예: 인천 → 바르셀로나 KE385)" placeholderTextColor={colors.faint} />
          <TextInput
            style={[styles.input, styles.area]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder={'예약번호, 시간, 좌석 등\n예: 예약번호 ABC123 · 10/1 11:20 출발'}
            placeholderTextColor={colors.faint}
            textAlignVertical="top"
          />
          <View style={styles.composeActions}>
            <Pressable onPress={() => setComposing(false)} style={styles.btnGhost} accessibilityRole="button">
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable onPress={addVoucher} disabled={saving || !trip} style={[styles.btnPrimary, (saving || !trip) && styles.disabled]} accessibilityRole="button">
              <Text style={styles.btnPrimaryText}>{saving ? '저장 중…' : '저장'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setComposing(true)} style={styles.addBtn} accessibilityRole="button">
          <Icon name="add" size={20} color={colors.accent} />
          <Text style={styles.addText}>티켓 추가</Text>
        </Pressable>
      )}
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
  chipScroll: { flexGrow: 0 },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: { paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextOn: { color: '#fff' },
  ticket: { borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 12, fontWeight: '800' },
  ticketTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, letterSpacing: -0.3, marginTop: 2 },
  perf: { height: NOTCH, justifyContent: 'center' },
  perfLine: { marginHorizontal: NOTCH, borderTopWidth: 1.5, borderStyle: 'dashed', borderTopColor: colors.line },
  notch: { position: 'absolute', top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  notchLeft: { left: -NOTCH / 2 - 1 },
  notchRight: { right: -NOTCH / 2 - 1 },
  ticketBody: { gap: space.sm, padding: space.lg, paddingTop: space.md },
  bodyText: { fontSize: 15, lineHeight: 23, color: colors.ink },
  bodyEmpty: { fontSize: 14, color: colors.faint },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  copyText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.accentSoft },
  addText: { fontSize: 15, fontWeight: '800', color: colors.accent },
  compose: { gap: space.md, padding: space.lg, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  composeTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.control, backgroundColor: colors.surfaceMuted },
  typeText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  typeTextOn: { color: '#fff' },
  input: { minHeight: 48, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, fontSize: 15, color: colors.ink },
  area: { minHeight: 110 },
  composeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  btnGhost: { paddingHorizontal: space.lg, height: 44, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  btnPrimary: { paddingHorizontal: space.xl, height: 44, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' }
});
