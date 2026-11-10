import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuide } from '../GuideContext';
import { PINNED, countryFlag, countryLabel, countryLabels, parseCountries, searchCountries } from '../countries';
import { colors, formatRange, radius, space } from '../theme';
import { Icon, Screen } from '../ui';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ChangePasswordScreen from './ChangePasswordScreen';
import { clearGuideCache, refreshGuideCache } from '../sync';

const DAY_MS = 86400000;

const emptyForm = () => ({ id: null, title: '', destination: '', country: '', startDate: '', endDate: '' });

/** 숫자만 입력해도 2026-10-01 형태로 만든다 */
function formatDateInput(text) {
  const d = String(text ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** 박수·일수 요약: "6박 7일" */
function durationText(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b || b < a) return '';
  const days = Math.round((b - a) / DAY_MS) + 1;
  return days === 1 ? '당일치기' : `${days - 1}박 ${days}일`;
}

function tripState(trip) {
  const a = parseDate(trip.startDate);
  const b = parseDate(trip.endDate);
  if (!a || !b) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < a) return { text: `D-${Math.round((a - today) / DAY_MS)}`, tone: 'soon' };
  if (today > b) return { text: '완료', tone: 'done' };
  return { text: '여행 중', tone: 'live' };
}

/* ---------- 여행 편집 시트 ---------- */

function TripSheet({ visible, form, setForm, saving, onSave, onDelete, onClose }) {
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const isEdit = form.id != null;
  const codes = parseCountries(form.country);
  const duration = durationText(form.startDate, form.endDate);

  useEffect(() => {
    if (!visible) {
      setAdding(false);
      setQuery('');
    }
  }, [visible]);

  const patch = (key, value) => setForm((cur) => ({ ...cur, [key]: value }));

  function toggleCountry(code) {
    const next = codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
    patch('country', next.join(','));
    setQuery('');
    setAdding(false);
  }

  const suggestions = (query.trim() ? searchCountries(query) : PINNED.map((code) => ({ code, name: countryLabel(code) })))
    .filter((item) => !codes.includes(item.code))
    .slice(0, 8);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Math.max(insets.top, space.md), paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <View style={styles.sheetHead}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.sheetTitle}>{isEdit ? '여행 수정' : '새 여행'}</Text>
          <View style={styles.sheetClose} />
        </View>

        <ScrollView style={styles.flex1} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>여행 이름</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => patch('title', v)} placeholder="예: 스페인 신혼여행" placeholderTextColor={colors.faint} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>도시·지역 (선택)</Text>
            <TextInput style={styles.input} value={form.destination} onChangeText={(v) => patch('destination', v)} placeholder="예: 바르셀로나" placeholderTextColor={colors.faint} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>국가</Text>
            <View style={styles.chips}>
              {codes.map((code) => (
                <Pressable key={code} onPress={() => toggleCountry(code)} style={[styles.chip, styles.chipOn]} accessibilityLabel={`${countryLabel(code)} 제거`}>
                  <Text style={[styles.chipText, styles.chipTextOn]}>{countryLabel(code)}</Text>
                  <Icon name="close" size={12} color="#fff" />
                </Pressable>
              ))}
              <Pressable onPress={() => setAdding((v) => !v)} style={styles.chip} accessibilityRole="button">
                <Icon name={adding ? 'close' : 'add'} size={14} color={colors.ink} />
                <Text style={styles.chipText}>{adding ? '닫기' : '국가 추가'}</Text>
              </Pressable>
            </View>
            {adding ? (
              <View style={styles.countryBox}>
                <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="국가 검색" placeholderTextColor={colors.faint} autoFocus />
                <View style={styles.chips}>
                  {suggestions.map((item) => (
                    <Pressable key={item.code} onPress={() => toggleCountry(item.code)} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {countryFlag(item.code)} {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>여행 기간</Text>
              {duration ? <Text style={styles.duration}>{duration}</Text> : null}
            </View>
            <View style={styles.dates}>
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>출발</Text>
                <TextInput
                  style={styles.dateInput}
                  value={form.startDate}
                  onChangeText={(v) => patch('startDate', formatDateInput(v))}
                  placeholder="2026-10-01"
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              <Icon name="arrow-forward" size={16} color={colors.faint} />
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>도착</Text>
                <TextInput
                  style={styles.dateInput}
                  value={form.endDate}
                  onChangeText={(v) => patch('endDate', formatDateInput(v))}
                  placeholder="2026-10-07"
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
            </View>
            <Text style={styles.hint}>숫자만 입력하면 하이픈이 자동으로 들어가요. 기간만큼 일차별 일정 칸이 만들어져요.</Text>
          </View>

          {isEdit ? (
            <Pressable onPress={onDelete} style={styles.deleteBtn} accessibilityRole="button">
              <Icon name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteText}>이 여행 삭제</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && styles.disabled]} accessibilityRole="button">
          <Text style={styles.saveText}>{saving ? '저장 중…' : isEdit ? '저장' : '여행 만들기'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/* ---------- 설정 화면 ---------- */

function Row({ icon, label, value, onPress, danger, last }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && onPress && styles.rowPressed]} accessibilityRole={onPress ? 'button' : 'text'}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Icon name={icon} size={18} color={danger ? colors.danger : colors.accentDark} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !danger ? <Icon name="chevron-forward" size={16} color={colors.faint} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen({ embed }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { trips, refresh: refreshGuide, offline, selectTrip } = useGuide();
  const { user, signOut } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');

  function openNew() {
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(trip) {
    setForm({
      id: trip.id,
      title: trip.title || '',
      destination: trip.destination || '',
      country: trip.country || '',
      startDate: trip.startDate || '',
      endDate: trip.endDate || ''
    });
    setSheetOpen(true);
  }

  // 홈의 "여행 만들기" 안내에서 들어오면 새 여행 시트를 바로 연다
  useEffect(() => {
    if (route.params?.newTrip) openNew();
  }, [route.params?.newTrip]);

  // 다른 화면의 "편집" 진입 (editTripId)
  useEffect(() => {
    const id = route.params?.editTripId;
    if (!id) return;
    const trip = trips.find((t) => t.id === id);
    if (trip) openEdit(trip);
  }, [route.params?.editTripId, trips.length]);

  async function save() {
    const start = parseDate(form.startDate);
    const end = parseDate(form.endDate);
    if (!form.title.trim()) return Alert.alert('여행 이름을 입력해 주세요.');
    if (!parseCountries(form.country).length) return Alert.alert('국가를 하나 이상 선택해 주세요.');
    if (!start || !end) return Alert.alert('날짜를 확인해 주세요', '출발·도착일을 2026-10-01 형식으로 입력해 주세요.');
    if (end < start) return Alert.alert('도착일이 출발일보다 빨라요', '기간을 다시 확인해 주세요.');
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        country: form.country,
        destination: form.destination.trim(),
        startDate: form.startDate,
        endDate: form.endDate
      };
      const isNew = !form.id;
      let created = null;
      if (form.id) await api.updateTrip(form.id, body);
      else created = await api.createTrip(body);
      setSheetOpen(false);
      setStatus(isNew ? '새 여행을 만들었어요.' : '여행 정보를 저장했어요.');
      await refreshGuide();
      // 새 여행을 만들었다면 바로 일정 등록 화면으로 안내한다
      if (isNew && created?.id) {
        selectTrip(created.id);
        navigation.navigate('Tabs', { screen: '여행', params: { section: 'schedule' } });
      }
    } catch (error) {
      Alert.alert('저장 실패', error.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`'${form.title || '이 여행'}' 삭제`, '일정·준비물·티켓·회화가 모두 함께 삭제돼요. 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTrip(form.id);
            setSheetOpen(false);
            setStatus('여행을 삭제했어요.');
            await refreshGuide();
          } catch (error) {
            Alert.alert('삭제 실패', error.message);
          }
        }
      }
    ]);
  }

  function confirmSignOut() {
    Alert.alert('로그아웃', '이 기기에 저장된 여행 복사본은 지워져요. 서버 데이터는 그대로예요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await clearGuideCache();
          await signOut();
        }
      }
    ]);
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setStatus('');
    try {
      await refreshGuideCache();
      await refreshGuide();
      setStatus('서버에서 최신 데이터를 불러왔어요.');
    } catch (error) {
      Alert.alert('동기화 실패', error.message || '네트워크 연결을 확인해 주세요.');
    } finally {
      setSyncing(false);
    }
  }

  function wipeCache() {
    Alert.alert('이 기기의 저장 데이터 비우기', '기기에 저장된 여행 복사본만 지워요. 서버 데이터는 그대로예요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '비우기',
        style: 'destructive',
        onPress: async () => {
          await clearGuideCache();
          await refreshGuide();
          setStatus('이 기기의 저장 데이터를 비웠어요.');
        }
      }
    ]);
  }

  return (
    <Screen scroll inHub={embed} contentStyle={styles.body}>
      {!embed && navigation.canGoBack() ? (
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="뒤로">
          <Icon name="chevron-back" size={22} color={colors.ink} />
          <Text style={styles.backText}>뒤로</Text>
        </Pressable>
      ) : null}

      {status ? (
        <View style={styles.status}>
          <Icon name="checkmark-circle" size={18} color={colors.forest} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>내 여행</Text>
        <Pressable onPress={openNew} style={styles.newBtn} accessibilityRole="button" accessibilityLabel="새 여행">
          <Icon name="add" size={16} color="#fff" />
          <Text style={styles.newText}>새 여행</Text>
        </Pressable>
      </View>

      {trips.length ? (
        trips.map((trip) => {
          const state = tripState(trip);
          const duration = durationText(trip.startDate, trip.endDate);
          return (
            <Pressable key={trip.id} onPress={() => openEdit(trip)} style={({ pressed }) => [styles.trip, pressed && styles.rowPressed]} accessibilityRole="button" accessibilityLabel={`${trip.title} 수정`}>
              <View style={styles.flagBox}>
                <Text style={styles.flag}>{parseCountries(trip.country).slice(0, 1).map(countryFlag).join('') || '🌍'}</Text>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.tripTitle} numberOfLines={1}>
                  {trip.title}
                </Text>
                <Text style={styles.tripMeta} numberOfLines={1}>
                  {[trip.destination || countryLabels(trip.country), formatRange(trip.startDate, trip.endDate), duration].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {state ? (
                <View style={[styles.stateTag, state.tone === 'live' && styles.stateLive, state.tone === 'done' && styles.stateDone]}>
                  <Text style={[styles.stateText, state.tone === 'live' && styles.stateTextLive]}>{state.text}</Text>
                </View>
              ) : null}
              <Icon name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Icon name="airplane-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>아직 등록된 여행이 없어요</Text>
          <Text style={styles.emptyText}>이름·국가·기간만 입력하면 일차별 일정 칸이 자동으로 만들어져요.</Text>
          <Pressable onPress={openNew} style={styles.emptyBtn} accessibilityRole="button">
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.newText}>첫 여행 만들기</Text>
          </Pressable>
        </View>
      )}

      <Text style={[styles.sectionTitle, styles.sectionGap]}>데이터</Text>
      <View style={styles.group}>
        <Row icon="cloud-download-outline" label={syncing ? '불러오는 중…' : '서버에서 새로 불러오기'} value={offline ? '오프라인' : ''} onPress={syncNow} />
        <Row icon="trash-outline" label="이 기기의 저장 데이터 비우기" onPress={wipeCache} danger last />
      </View>

      <Text style={[styles.sectionTitle, styles.sectionGap]}>계정</Text>
      <View style={styles.group}>
        <Row icon="person-circle-outline" label="로그인 계정" value={user?.email || ""} />
        <Row icon="key-outline" label="비밀번호 변경" onPress={() => setPwOpen(true)} />
        <Row icon="log-out-outline" label="로그아웃" onPress={confirmSignOut} danger last />
      </View>

      <Text style={[styles.sectionTitle, styles.sectionGap]}>정보</Text>
      <View style={styles.group}>
        <Row icon="cloud-outline" label="서버" value="Supabase" />
        <Row icon="phone-portrait-outline" label="사진 원본" value="이 기기에만 저장" last />
      </View>

      <Modal visible={pwOpen} animationType="slide" onRequestClose={() => setPwOpen(false)}>
        <ChangePasswordScreen
          onClose={() => setPwOpen(false)}
          onDone={() => {
            setPwOpen(false);
            setStatus('비밀번호를 변경했어요.');
          }}
        />
      </Modal>

      <TripSheet visible={sheetOpen} form={form} setForm={setForm} saving={saving} onSave={save} onDelete={confirmDelete} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.forestSoft },
  statusText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.forest },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  sectionGap: { marginTop: space.md },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.accent },
  newText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  trip: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  flagBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  flag: { fontSize: 24 },
  tripTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  tripMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  stateTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  stateLive: { backgroundColor: colors.tram },
  stateDone: { backgroundColor: colors.surfaceMuted },
  stateText: { fontSize: 11, fontWeight: '800', color: colors.accentDark },
  stateTextLive: { color: colors.navy },
  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, paddingHorizontal: space.xl, height: 46, borderRadius: radius.pill, backgroundColor: colors.accent },
  group: { borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowPressed: { backgroundColor: colors.surfaceTint },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: '#FBE4E1' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  rowValue: { flexShrink: 1, maxWidth: '50%', fontSize: 13, color: colors.muted },

  sheet: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sheetBody: { gap: space.xl, paddingBottom: space.xl },
  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  duration: { fontSize: 13, fontWeight: '800', color: colors.accent },
  input: { height: 50, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 16, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  chipTextOn: { color: '#fff' },
  countryBox: { gap: space.sm },
  dates: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  dateBox: { flex: 1, gap: 4 },
  dateLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  dateInput: { height: 50, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.control, backgroundColor: '#FBE4E1' },
  deleteText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  saveBtn: { height: 54, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' }
});
