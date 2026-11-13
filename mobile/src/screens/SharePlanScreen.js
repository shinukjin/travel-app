import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGuide } from '../GuideContext';
import { api } from '../api';
import { buildShareLink, expiryText, parseShareToken } from '../shareLink';
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
import { Icon, TripLabel } from '../ui';

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
  const navigation = useNavigation();
  // 링크로 공유
  const [linkBusy, setLinkBusy] = useState(false);
  const [links, setLinks] = useState([]);
  const [linkNotice, setLinkNotice] = useState('');
  // 링크 받기 (붙여넣기)
  const [linkInput, setLinkInput] = useState('');

  const loadLinks = useCallback(async () => {
    try {
      const rows = await api.mySharedPlans();
      setLinks((rows || []).filter((r) => new Date(r.expires_at) > new Date()));
    } catch {
      setLinks([]); // 서버 설정(0007 SQL)이 아직 없거나 오프라인이면 목록만 숨긴다
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLinks();
    }, [loadLinks])
  );

  async function onShareLink() {
    if (!trip || !portable) return;
    setLinkBusy(true);
    setLinkNotice('');
    try {
      const row = await api.createSharedPlan({ title: trip.title, payload: portable });
      const link = buildShareLink(row.token);
      const message = `${trip.title} 일정을 보냈어요.\n앱에서 아래 링크를 열면 원하는 부분만 골라 가져올 수 있어요.\n${link}\n(${expiryText(row.expires_at)} 열 수 있어요)`;
      await sharePlanText(trip.title, message);
      loadLinks();
    } catch (e) {
      setLinkNotice(e.message?.includes('shared_plans') ? '링크 기능이 아직 서버에 설정되지 않았어요. (0007_shared_plans.sql 적용 필요)' : e.message || '링크를 만들지 못했어요. 인터넷 연결을 확인해 주세요.');
    } finally {
      setLinkBusy(false);
    }
  }

  function removeLink(row) {
    Alert.alert('링크 삭제', '삭제하면 이 링크로는 더 이상 열 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSharedPlan(row.id);
            loadLinks();
          } catch {
            Alert.alert('삭제하지 못했어요', '인터넷 연결을 확인해 주세요.');
          }
        }
      }
    ]);
  }

  function openLink() {
    const token = parseShareToken(linkInput);
    if (!token) {
      Alert.alert('링크를 확인해 주세요', 'honeymoon://share/… 로 시작하는 링크를 붙여넣어 주세요.');
      return;
    }
    setLinkInput('');
    navigation.navigate('공유 가져오기', { token });
  }

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
              <Icon name={m.icon} size={16} color={on ? colors.accentDark : colors.muted} />
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'export' ? (
        <>
          <TripLabel trip={trip} />

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
                <ToggleRow label="티켓 · 바우처" hint="예약번호 등이 받는 사람에게 보여요" value={options.vouchers} onChange={(vouchers) => setOptions((o) => ({ ...o, vouchers }))} />
                <ToggleRow label="회화" value={options.phrases} onChange={(phrases) => setOptions((o) => ({ ...o, phrases }))} />
                <ToggleRow label="준비물" value={options.packing} onChange={(packing) => setOptions((o) => ({ ...o, packing }))} />
                <ToggleRow label="지도 링크" hint="사람이 읽는 글에만 들어가요" value={options.mapLinks} onChange={(mapLinks) => setOptions((o) => ({ ...o, mapLinks }))} last />
              </View>

              {/* 링크로 공유 — 받는 사람이 앱에서 열어 무엇을, 어떻게 적용할지 고른다 */}
              <Pressable onPress={onShareLink} disabled={linkBusy || !portable} style={[styles.primary, (linkBusy || !portable) && styles.disabled]} accessibilityRole="button">
                {linkBusy ? <ActivityIndicator color="#fff" /> : <Icon name="link" size={18} color="#fff" />}
                <Text style={styles.primaryText}>{linkBusy ? '링크 만드는 중…' : '링크로 공유'}</Text>
              </Pressable>
              <Text style={styles.linkHint}>받는 사람이 앱에서 링크를 열면 가져올 항목과 적용 방식(새 여행 · 합치기 · 덮어쓰기)을 직접 고를 수 있어요. 14일 뒤 만료돼요.</Text>
              {linkNotice ? <Text style={styles.warn}>{linkNotice}</Text> : null}

              <Pressable onPress={onShare} disabled={!sharePayload || sharing} style={[styles.secondaryWide, (!sharePayload || sharing) && styles.disabled]} accessibilityRole="button">
                <Icon name="share-social-outline" size={16} color={colors.ink} />
                <Text style={styles.secondaryText}>{sharing ? '공유 중…' : '글 + 코드로 공유 (예전 방식)'}</Text>
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

              {links.length ? (
                <>
                  <Text style={styles.sectionTitle}>보낸 링크</Text>
                  <View style={styles.group}>
                    {links.map((row, i) => (
                      <View key={row.id} style={[styles.linkRow, i < links.length - 1 && styles.toggleLine]}>
                        <View style={styles.flex1}>
                          <Text style={styles.toggleLabel} numberOfLines={1}>
                            {row.title}
                          </Text>
                          <Text style={styles.toggleHint}>{expiryText(row.expires_at)} 열 수 있어요</Text>
                        </View>
                        <Pressable onPress={() => copyPlanText(buildShareLink(row.token))} hitSlop={8} style={styles.linkBtn} accessibilityRole="button" accessibilityLabel="링크 복사">
                          <Icon name="copy-outline" size={16} color={colors.ink} />
                        </Pressable>
                        <Pressable onPress={() => removeLink(row)} hitSlop={8} style={styles.linkBtn} accessibilityRole="button" accessibilityLabel="링크 삭제">
                          <Icon name="trash-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

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
            <Text style={styles.stepsTitle}>링크로 받기</Text>
            <Text style={styles.stepsText}>받은 링크를 눌러 앱이 열리면 자동으로 가져오기 화면이 나와요. 링크가 열리지 않으면 아래에 붙여넣어 주세요.</Text>
          </View>
          <View style={styles.linkInputRow}>
            <TextInput
              style={styles.linkInput}
              value={linkInput}
              onChangeText={setLinkInput}
              placeholder="honeymoon://share/…"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={openLink}
              returnKeyType="go"
            />
            <Pressable onPress={openLink} disabled={!linkInput.trim()} style={[styles.linkOpen, !linkInput.trim() && styles.disabled]} accessibilityRole="button">
              <Text style={styles.linkOpenText}>열기</Text>
            </Pressable>
          </View>

          <View style={styles.steps}>
            <Text style={styles.stepsTitle}>예전 방식: 코드 받기</Text>
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
  modeOn: { backgroundColor: colors.card },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  modeTextOn: { color: colors.accentDark },
  // 요약 — 진한 남색 대신 연한 파랑 바탕
  summary: { gap: 4, padding: space.lg, borderRadius: radius.sheet, backgroundColor: colors.accentSoft },
  summaryTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  summaryMeta: { fontSize: 13, color: colors.muted },
  stats: { flexDirection: 'row', marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(31,79,163,0.18)' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.accentDark },
  statLabel: { fontSize: 12, color: colors.muted },
  offline: { fontSize: 13, fontWeight: '600', color: colors.accent },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  group: { borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  toggleLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  toggleHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: radius.control, backgroundColor: colors.accent },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  linkHint: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: -space.sm },
  secondaryWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, paddingHorizontal: space.lg },
  linkBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  linkInputRow: { flexDirection: 'row', gap: space.sm },
  linkInput: { flex: 1, height: 48, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 14, color: colors.ink },
  linkOpen: { paddingHorizontal: space.lg, height: 48, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  linkOpenText: { fontSize: 14, fontWeight: '800', color: '#fff' },
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
