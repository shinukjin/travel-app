import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useGuide } from '../GuideContext';
import { StackPage } from '../components/StackPage';
import {
  buildPortablePlan,
  extractPortablePlan,
  importPortablePlan,
  planSummary,
  wrapPortableText
} from '../planTransfer';
import { DEFAULT_SHARE_OPTIONS, buildPlanText, copyPlanText, sharePlanText } from '../sharePlan';
import { colors, formatRange, radius, space } from '../theme';
import { Icon, TripPicker } from '../ui';

const MODES = [
  { id: 'export', label: '보내기', icon: 'paper-plane-outline' },
  { id: 'import', label: '받기', icon: 'download-outline' }
];

function ToggleRow({ label, hint, value, onChange, last }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.toggle, !last && styles.toggleLine]} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={styles.flex1}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor="#fff"
        ios_backgroundColor={colors.line}
      />
    </Pressable>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function SharePlanScreen({ embed }) {
  const { trip, trips, tripId, data, loading, offline, selectTrip, refresh } = useGuide();
  const [mode, setMode] = useState('export');
  const [options, setOptions] = useState(DEFAULT_SHARE_OPTIONS);
  const [sharing, setSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importing, setImporting] = useState(false);

  const days = trip ? data.schedules[trip.id] || [] : [];
  const vouchers = trip ? data.vouchers[trip.id] || [] : [];
  const phrases = trip ? data.phrases[trip.id] || [] : [];
  const packing = trip ? data.packing[trip.id] || [] : [];
  const stopCount = days.reduce((sum, d) => sum + (d.items?.length || 0), 0);

  const portable = useMemo(() => (trip ? buildPortablePlan(trip, days, vouchers, phrases, packing, options) : null), [trip, days, vouchers, phrases, packing, options]);
  const importPreview = useMemo(() => extractPortablePlan(importRaw), [importRaw]);
  const readablePreview = useMemo(() => (trip ? buildPlanText(trip, days, vouchers, phrases, packing, options) : ''), [trip, days, vouchers, phrases, packing, options]);
  const codePreview = useMemo(() => (portable ? wrapPortableText(portable) : ''), [portable]);
  const sharePayload = useMemo(() => [readablePreview, codePreview].filter(Boolean).join('\n\n'), [readablePreview, codePreview]);

  async function onShare() {
    if (!trip || !sharePayload) return;
    setSharing(true);
    try {
      await sharePlanText(trip.title, sharePayload);
    } finally {
      setSharing(false);
    }
  }

  async function onImport() {
    const plan = extractPortablePlan(importRaw);
    if (!plan) {
      Alert.alert('가져오기 실패', '코드 형식을 확인해 주세요. BEGIN/END 블록 또는 JSON 전체를 붙여넣으세요.');
      return;
    }
    setImporting(true);
    try {
      const result = await importPortablePlan(plan);
      await refresh();
      selectTrip(result.tripId);
      setImportRaw('');
      setMode('export');
      Alert.alert('가져오기 완료', planSummary(plan));
    } catch (error) {
      Alert.alert('가져오기 실패', error.message || '다시 시도해 주세요.');
    } finally {
      setImporting(false);
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
    <StackPage title="일정 공유" contentStyle={styles.body} embed={embed}>
      <View style={styles.modes}>
        {MODES.map((m) => {
          const on = m.id === mode;
          return (
            <Pressable key={m.id} onPress={() => setMode(m.id)} style={[styles.mode, on && styles.modeOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Icon name={m.icon} size={16} color={on ? '#fff' : colors.muted} />
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'export' ? (
        <>
          {trips.length > 1 ? <TripPicker trips={trips} tripId={tripId} onSelect={selectTrip} /> : null}

          {trip ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {trip.title}
              </Text>
              <Text style={styles.summaryMeta}>{[trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ')}</Text>
              <View style={styles.stats}>
                <Stat label="일정" value={`${stopCount}곳`} />
                <Stat label="티켓" value={vouchers.length} />
                <Stat label="회화" value={phrases.length} />
                <Stat label="준비물" value={packing.length} />
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="share-social-outline" size={28} color={colors.accent} />
              <Text style={styles.emptyTitle}>공유할 여행이 없어요</Text>
              <Text style={styles.emptyText}>도구 → 설정에서 여행을 만든 뒤 일정을 공유할 수 있어요.</Text>
            </View>
          )}
          {offline ? <Text style={styles.offline}>오프라인 — 저장된 일정 기준으로 공유해요.</Text> : null}

          {trip ? (
            <>
              <Text style={styles.sectionTitle}>포함할 내용</Text>
              <View style={styles.group}>
                <ToggleRow label="티켓 · 바우처" hint="예약번호 등이 코드에 포함돼요" value={options.vouchers} onChange={(vouchers) => setOptions((o) => ({ ...o, vouchers }))} />
                <ToggleRow label="회화" value={options.phrases} onChange={(phrases) => setOptions((o) => ({ ...o, phrases }))} />
                <ToggleRow label="준비물" value={options.packing} onChange={(packing) => setOptions((o) => ({ ...o, packing }))} />
                <ToggleRow label="지도 링크" hint="사람이 읽는 글에만 들어가요" value={options.mapLinks} onChange={(mapLinks) => setOptions((o) => ({ ...o, mapLinks }))} last />
              </View>

              <Pressable onPress={onShare} disabled={!sharePayload || sharing} style={[styles.primary, (!sharePayload || sharing) && styles.disabled]} accessibilityRole="button">
                <Icon name="share-social" size={18} color="#fff" />
                <Text style={styles.primaryText}>{sharing ? '공유 중…' : '공유하기'}</Text>
              </Pressable>
              <View style={styles.row2}>
                <Pressable onPress={() => readablePreview && copyPlanText(readablePreview)} disabled={!readablePreview} style={[styles.secondary, !readablePreview && styles.disabled]} accessibilityRole="button">
                  <Icon name="document-text-outline" size={16} color={colors.ink} />
                  <Text style={styles.secondaryText}>글만 복사</Text>
                </Pressable>
                <Pressable onPress={() => codePreview && copyPlanText(codePreview)} disabled={!codePreview} style={[styles.secondary, !codePreview && styles.disabled]} accessibilityRole="button">
                  <Icon name="code-slash-outline" size={16} color={colors.ink} />
                  <Text style={styles.secondaryText}>코드만 복사</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setShowPreview((v) => !v)} style={styles.previewHead} accessibilityRole="button">
                <Text style={styles.sectionTitle}>미리보기</Text>
                <Icon name={showPreview ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {showPreview ? (
                <>
                  <Text style={styles.previewLabel}>읽기용 글</Text>
                  <TextInput style={styles.preview} value={readablePreview || '공유할 일정이 없습니다.'} multiline editable={false} />
                  <Text style={styles.previewLabel}>앱 가져오기 코드</Text>
                  <TextInput style={[styles.preview, styles.code]} value={codePreview || '—'} multiline editable={false} />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.steps}>
            <Text style={styles.stepsTitle}>친구가 보낸 일정 받기</Text>
            <Text style={styles.stepsText}>받은 메시지 전체를 아래에 붙여넣으면 일정·티켓·준비물이 새 여행으로 추가돼요.</Text>
          </View>
          <TextInput
            style={styles.paste}
            value={importRaw}
            onChangeText={setImportRaw}
            multiline
            placeholder="받은 전체 메시지를 붙여넣으세요…"
            placeholderTextColor={colors.faint}
            textAlignVertical="top"
          />
          {importPreview ? (
            <View style={styles.found}>
              <Icon name="checkmark-circle" size={22} color={colors.forest} />
              <View style={styles.flex1}>
                <Text style={styles.foundTitle}>여행을 찾았어요</Text>
                <Text style={styles.foundText}>{planSummary(importPreview)}</Text>
              </View>
            </View>
          ) : importRaw.trim() ? (
            <Text style={styles.warn}>아직 인식되지 않았어요. BEGIN/END 블록이 포함됐는지 확인해 주세요.</Text>
          ) : null}
          <Pressable onPress={onImport} disabled={!importPreview || importing} style={[styles.primary, (!importPreview || importing) && styles.disabled]} accessibilityRole="button">
            <Icon name="download" size={18} color="#fff" />
            <Text style={styles.primaryText}>{importing ? '가져오는 중…' : '여행으로 가져오기'}</Text>
          </Pressable>
          <Text style={styles.footnote}>서버({offline ? '오프라인' : '온라인'})에 새 여행을 만들어 넣어요. 오프라인이면 이 기기에만 저장돼요.</Text>
        </>
      )}
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  flex1: { flex: 1 },
  disabled: { opacity: 0.45 },
  modes: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.pill },
  modeOn: { backgroundColor: colors.navy },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  modeTextOn: { color: '#fff' },
  summary: { gap: 4, padding: space.lg, borderRadius: radius.sheet, backgroundColor: colors.navy },
  summaryTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  summaryMeta: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  stats: { flexDirection: 'row', marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.tram },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  offline: { fontSize: 13, fontWeight: '600', color: colors.accent },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  group: { borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  toggleLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  toggleHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: radius.control, backgroundColor: colors.accent },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  row2: { flexDirection: 'row', gap: space.sm, marginTop: -space.xs },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: -space.sm },
  preview: { minHeight: 120, maxHeight: 220, padding: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 13, lineHeight: 20, color: colors.ink },
  code: { backgroundColor: colors.surfaceMuted, fontSize: 11, lineHeight: 16 },
  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  steps: { gap: 4, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.accentSoft },
  stepsTitle: { fontSize: 16, fontWeight: '800', color: colors.accentDark },
  stepsText: { fontSize: 14, color: colors.accentDark, lineHeight: 20 },
  paste: { minHeight: 170, maxHeight: 300, padding: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 13, lineHeight: 19, color: colors.ink },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.forestSoft },
  foundTitle: { fontSize: 15, fontWeight: '800', color: colors.forest },
  foundText: { fontSize: 14, color: colors.ink, marginTop: 2 },
  warn: { fontSize: 13, color: colors.muted },
  footnote: { fontSize: 12, color: colors.faint, textAlign: 'center' }
});
