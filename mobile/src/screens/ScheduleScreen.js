import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { navigatePlaceInfo } from '../placeInfo';
import { useGuide } from '../GuideContext';
import { categoryMeta, colors, formatDay, formatTime, formatWeek, radius, space } from '../theme';
import PlacePicker from '../components/PlacePicker';
import { Icon, Screen, TravelLeg, TripPicker } from '../ui';

/* ---------- 시간 입력 도우미 ---------- */

/** 숫자만 입력해도 09:30 형태로 만든다 */
function formatTimeInput(text) {
  const d = String(text ?? '').replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

function validTime(value) {
  if (!value) return true;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** 마지막 일정 1시간 뒤 (없으면 09:00) */
function nextSlot(value) {
  if (!value || !validTime(value)) return '09:00';
  const [h, m] = value.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const toDraft = (item) => ({
  key: String(item.id),
  place: item.place,
  startTime: item.startTime ? String(item.startTime).slice(0, 5) : '',
  note: item.note || ''
});

/** 웹에서는 Alert 버튼이 동작하지 않아 window.confirm 을 쓴다 */
function confirmDelete(title, message, onOk, okLabel = '삭제') {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(title + '\n' + message)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk }
  ]);
}

let draftSeq = 0;
const newDraft = (place, startTime) => ({ key: `new-${++draftSeq}`, place, startTime, note: '' });

/* ---------- 일정 화면 ---------- */

export default function ScheduleScreen({ embed }) {
  const navigation = useNavigation();
  const { trip, trips, tripId, days, loading, selectTrip, refresh } = useGuide();
  const [dayId, setDayId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(() => new Set());
  // 장소 추가 화면에서 지운 내 장소: 일정을 저장할 때 한 번만 확인하고 실제로 삭제한다
  const [pendingDel, setPendingDel] = useState(() => new Map());
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (!days.length) {
      setDayId(null);
      return;
    }
    if (!days.some((d) => d.id === dayId)) setDayId(days[0].id);
  }, [tripId, days]);

  useEffect(() => {
    setEditing(false);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const day = days.find((item) => item.id === dayId) || days[0];
  const items = day?.items || [];
  const today = new Date().toISOString().slice(0, 10);
  const nowHm = new Date().toTimeString().slice(0, 5);
  const nextStop = !items.length
    ? null
    : day?.date === today
      ? items.find((item) => formatTime(item.startTime) >= nowHm) || items[items.length - 1]
      : items[0];

  const addedIds = useMemo(() => new Set(draft.map((d) => d.place?.id).filter(Boolean)), [draft]);
  const pendingIds = useMemo(() => new Set(pendingDel.keys()), [pendingDel]);
  const dirty = editing && (pendingDel.size > 0 || JSON.stringify(draft.map((d) => [d.place?.id, d.startTime, d.note])) !== JSON.stringify(items.map((i) => { const d = toDraft(i); return [d.place?.id, d.startTime, d.note]; })));

  function openDirections(place) {
    const q = place?.nameLocal || place?.name;
    if (!q) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`);
  }

  function startEdit() {
    setPendingDel(new Map());
    setNotesOpen(new Set());
    setDraft(items.map(toDraft));
    setEditing(true);
  }

  function switchDay(id) {
    if (id === dayId) return;
    if (!editing) {
      setDayId(id);
      return;
    }
    const go = () => {
      setEditing(false);
      setDayId(id);
    };
    if (!dirty) {
      go();
      return;
    }
    confirmDelete('다른 날로 이동할까요?', '저장하지 않은 수정 내용이 사라져요.', go, '이동');
  }

  function cancelEdit() {
    if (!dirty) {
      setEditing(false);
      return;
    }
    confirmDelete('변경 사항을 버릴까요?', '저장하지 않은 수정 내용이 사라져요.', () => setEditing(false), '버리기');
  }

  function patchDraft(key, patch) {
    setDraft((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function move(index, delta) {
    setDraft((list) => {
      const next = [...list];
      const to = index + delta;
      if (to < 0 || to >= next.length) return list;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function remove(key) {
    setDraft((list) => list.filter((d) => d.key !== key));
  }

  function sortByTime() {
    setDraft((list) =>
      list
        .map((d, i) => ({ d, i }))
        .sort((a, b) => {
          if (!a.d.startTime && !b.d.startTime) return a.i - b.i;
          if (!a.d.startTime) return 1;
          if (!b.d.startTime) return -1;
          return a.d.startTime.localeCompare(b.d.startTime) || a.i - b.i;
        })
        .map((x) => x.d)
    );
  }

  /** 장소 추가 화면에서 내 장소 삭제: 목록에서만 숨기고, 저장할 때 실제로 지운다 */
  function stageDelete(place) {
    setPendingDel((m) => new Map(m).set(place.id, place));
    setDraft((list) => list.filter((d) => d.place?.id !== place.id));
  }

  function pickPlace(place) {
    setDraft((list) => [...list, newDraft(place, nextSlot(list[list.length - 1]?.startTime))]);
    setAddedCount((n) => n + 1);
  }

  /** 저장: 삭제 예정 장소가 있으면 그때 한 번만 확인한다 */
  function save() {
    if (draft.some((d) => !validTime(d.startTime))) {
      Alert.alert('시간 형식을 확인해 주세요', '예: 09:30 (24시간제)');
      return;
    }
    if (pendingDel.size) {
      const names = [...pendingDel.values()].map((p) => p.name);
      const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` 외 ${names.length - 3}곳` : '');
      confirmDelete(
        `내 장소 ${names.length}곳을 삭제하고 저장할까요?`,
        `${shown}\n삭제한 장소는 다른 날짜 일정에서도 사라져요.`,
        doSave,
        '삭제하고 저장'
      );
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      await api.replaceScheduleItems(
        day.id,
        draft.map((d, i) => ({ placeId: d.place.id, sortOrder: i, startTime: d.startTime || null, note: d.note.trim() || null }))
      );
      for (const id of pendingDel.keys()) await api.deletePlace(id);
      setPendingDel(new Map());
      await refresh();
      setEditing(false);
    } catch (e) {
      Alert.alert('저장 실패', e.message || '네트워크 연결을 확인해 주세요.');
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

  if (!trip || !days.length) {
    return (
      <Screen scroll inHub={embed} contentStyle={styles.body}>
        {trips.length > 1 ? <TripPicker trips={trips} tripId={tripId} onSelect={selectTrip} /> : null}
        <View style={styles.emptyCard}>
          <Icon name="calendar-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>{trip ? '일정 칸이 아직 없어요' : '첫 여행을 추가해 주세요'}</Text>
          <Text style={styles.emptyText}>
            {trip ? '여행 기간을 확인해 주세요. 날짜가 정해지면 일차별 일정이 만들어져요.' : '도구 탭의 설정에서 새 여행을 만들 수 있어요.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll inHub={embed} contentStyle={styles.body}>
      {trips.length > 1 ? <TripPicker trips={trips} tripId={tripId} onSelect={selectTrip} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.dayRow}>
        {days.map((d) => {
          const on = d.id === day.id;
          const [, m, dd] = d.date.split('-');
          return (
            <Pressable
              key={d.id}
              onPress={() => switchDay(d.id)}
              style={[styles.dayChip, on && styles.dayChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.dayIdx, on && styles.dayIdxOn]}>{d.dayIndex}일차</Text>
              <Text style={[styles.dayDate, on && styles.dayDateOn]}>
                {Number(m)}.{Number(dd)}
              </Text>
              <Text style={[styles.dayWeek, on && styles.dayIdxOn]}>{formatWeek(d.date)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dayHead}>
        <View style={styles.flex1}>
          <Text style={styles.dayTitle}>{formatDay(day.date)}</Text>
          <Text style={styles.daySub}>
            {editing ? `${draft.length}곳 · 편집 중` : items.length ? `${items.length}곳` : '아직 비어 있어요'}
          </Text>
        </View>
        {editing ? (
          <View style={styles.rowEnd}>
            <Pressable onPress={cancelEdit} style={styles.btnGhost} accessibilityRole="button">
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving || !dirty} style={[styles.btnPrimary, (saving || !dirty) && styles.disabled]} accessibilityRole="button">
              <Text style={styles.btnPrimaryText}>{saving ? '저장 중…' : '저장'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={startEdit} style={styles.editBtn} accessibilityRole="button" accessibilityLabel="일정 편집">
            <Icon name="create-outline" size={16} color={colors.ink} />
            <Text style={styles.editBtnText}>편집</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={styles.editList}>
          {draft.map((d, index) => {
            const meta = categoryMeta[d.place?.category] || categoryMeta.SIGHT;
            const badTime = !validTime(d.startTime);
            const noteOpen = !!d.note || notesOpen.has(d.key);
            return (
              <View key={d.key} style={styles.editCard}>
                <View style={styles.editRow}>
                  <View style={[styles.timeBox, badTime && styles.timeBad]}>
                    <TextInput
                      style={styles.timeInput}
                      value={d.startTime}
                      onChangeText={(t) => patchDraft(d.key, { startTime: formatTimeInput(t) })}
                      placeholder="--:--"
                      placeholderTextColor={colors.faint}
                      keyboardType="number-pad"
                      maxLength={5}
                      selectTextOnFocus
                      accessibilityLabel={`${d.place?.name} 시작 시간`}
                    />
                  </View>
                  <View style={styles.editMain}>
                    <Text style={styles.editName} numberOfLines={2}>
                      {d.place?.name}
                    </Text>
                    <View style={styles.editMetaRow}>
                      <Icon name={meta.icon} size={12} color={meta.color} />
                      <Text style={[styles.editMeta, { color: meta.color }]}>{meta.label}</Text>
                      {!noteOpen ? (
                        <Pressable onPress={() => setNotesOpen((set) => new Set(set).add(d.key))} hitSlop={8} accessibilityRole="button">
                          <Text style={styles.addNote}>+ 메모</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.moveCol}>
                    <Pressable onPress={() => move(index, -1)} disabled={index === 0} hitSlop={4} style={[styles.moveBtn, index === 0 && styles.disabled]} accessibilityLabel="위로">
                      <Icon name="chevron-up" size={20} color={colors.ink} />
                    </Pressable>
                    <Pressable onPress={() => move(index, 1)} disabled={index === draft.length - 1} hitSlop={4} style={[styles.moveBtn, index === draft.length - 1 && styles.disabled]} accessibilityLabel="아래로">
                      <Icon name="chevron-down" size={20} color={colors.ink} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => remove(d.key)} hitSlop={6} style={styles.delBtn} accessibilityLabel={`${d.place?.name} 삭제`}>
                    <Icon name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                {noteOpen ? (
                  <TextInput
                    style={styles.noteInput}
                    value={d.note}
                    onChangeText={(t) => patchDraft(d.key, { note: t })}
                    placeholder="메모 (예약번호, 주의사항…)"
                    placeholderTextColor={colors.faint}
                    multiline
                  />
                ) : null}
              </View>
            );
          })}

          <View style={styles.addRow}>
            <Pressable
              onPress={() => {
                setAddedCount(0);
                setPickerOpen(true);
              }}
              style={styles.addPlace}
              accessibilityRole="button"
            >
              <Icon name="add" size={20} color={colors.accent} />
              <Text style={styles.addPlaceText}>장소 추가</Text>
            </Pressable>
            {draft.length > 1 ? (
              <Pressable onPress={sortByTime} style={styles.sortBtn} accessibilityRole="button">
                <Icon name="swap-vertical" size={16} color={colors.ink} />
                <Text style={styles.editBtnText}>시간순 정렬</Text>
              </Pressable>
            ) : null}
          </View>

          {!draft.length ? <Text style={styles.emptyText}>아직 장소가 없어요. 위 버튼으로 가고 싶은 곳을 추가해 보세요.</Text> : null}

          <Pressable
            onPress={save}
            disabled={saving || !dirty}
            style={[styles.saveWide, (saving || !dirty) && styles.disabled]}
            accessibilityRole="button"
          >
            <Text style={styles.saveWideText}>{saving ? '저장 중…' : dirty ? '변경 사항 저장' : '변경 사항 없음'}</Text>
          </Pressable>
        </View>
      ) : items.length ? (
        <View>
          {items.map((item, index) => {
            const meta = categoryMeta[item.place?.category] || categoryMeta.SIGHT;
            const canRoute = !!item.place?.name;
            const upcoming = nextStop?.id === item.id;
            const last = index === items.length - 1;
            return (
              <View key={item.id} style={styles.stopRow}>
                <Text style={[styles.time, upcoming && styles.timeNext]}>{formatTime(item.startTime)}</Text>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: meta.color }, upcoming && styles.dotNext]} />
                  {!last ? <View style={styles.line} /> : null}
                </View>
                <View style={[styles.stopCol, !last && styles.stopColGap]}>
                  {index > 0 ? <TravelLeg from={items[index - 1].place} to={item.place} /> : null}
                  <Pressable
                    style={({ pressed }) => [styles.stop, upcoming && styles.stopNext, pressed && styles.pressed]}
                    onPress={() => navigatePlaceInfo(navigation, item.place, item.note)}
                    accessibilityRole="button"
                  >
                    <View style={styles.stopBody}>
                      <View style={styles.stopTags}>
                        <View style={[styles.tag, { backgroundColor: meta.soft }]}>
                          <Icon name={meta.icon} size={12} color={meta.color} />
                          <Text style={[styles.tagText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                        {upcoming ? (
                          <View style={styles.nextTag}>
                            <Text style={styles.nextTagText}>{day.date === today ? '다음' : '첫 장소'}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.stopTitle} numberOfLines={2}>
                        {item.place?.name}
                      </Text>
                      {item.place?.address ? (
                        <Text style={styles.stopSub} numberOfLines={1}>
                          {item.place.address}
                        </Text>
                      ) : null}
                      {item.note ? <Text style={styles.stopNote}>{item.note}</Text> : null}
                    </View>
                    {canRoute ? (
                      <Pressable
                        style={styles.go}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          openDirections(item.place);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.place.name} 길찾기`}
                      >
                        <Icon name="navigate" size={16} color={colors.accent} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Icon name="map-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>이 날은 아직 계획이 없어요</Text>
          <Text style={styles.emptyText}>가고 싶은 장소를 추가해 하루를 채워 보세요.</Text>
          <Pressable
            onPress={() => {
              startEdit();
              setAddedCount(0);
              setPickerOpen(true);
            }}
            style={styles.emptyBtn}
            accessibilityRole="button"
          >
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>장소 추가</Text>
          </Pressable>
        </View>
      )}

      <PlacePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickPlace}
        onDelete={stageDelete}
        onUndoDelete={() => setPendingDel(new Map())}
        addedCount={addedCount}
        addedIds={addedIds}
        pendingDelete={pendingIds}
        tripCountry={trip?.country || ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  flex1: { flex: 1 },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.4 },
  rowEnd: { flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'flex-end' },
  chipScroll: { flexGrow: 0 },
  dayRow: { gap: space.sm, paddingRight: space.lg },
  dayChip: {
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  dayChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  dayIdx: { fontSize: 11, fontWeight: '600', color: colors.muted },
  dayIdxOn: { color: 'rgba(255,255,255,0.7)' },
  dayDate: { fontSize: 16, fontWeight: '800', color: colors.ink },
  dayDateOn: { color: '#fff' },
  dayWeek: { fontSize: 11, fontWeight: '600', color: colors.faint },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dayTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  daySub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  btnGhost: { paddingHorizontal: space.lg, height: 40, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  btnPrimary: { paddingHorizontal: space.lg, height: 40, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  stopRow: { flexDirection: 'row', alignItems: 'stretch' },
  time: { width: 46, fontSize: 14, fontWeight: '700', color: colors.muted, paddingTop: 14, fontVariant: ['tabular-nums'] },
  timeNext: { color: colors.accent },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 18, borderWidth: 2, borderColor: colors.bg },
  dotNext: { width: 16, height: 16, borderRadius: 8, marginTop: 16 },
  line: { flex: 1, width: 2, backgroundColor: colors.line, marginTop: 2 },
  stopCol: { flex: 1, gap: space.sm },
  stopColGap: { paddingBottom: space.md },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line
  },
  stopNext: { borderColor: colors.accent, borderWidth: 1.5 },
  stopBody: { flex: 1, gap: 4 },
  stopTags: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { fontSize: 11, fontWeight: '700' },
  nextTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.tram },
  nextTagText: { fontSize: 11, fontWeight: '800', color: colors.navy },
  stopTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  stopSub: { fontSize: 12, color: colors.muted },
  stopNote: { fontSize: 14, color: colors.ink, marginTop: 2, lineHeight: 20 },
  go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },

  editList: { gap: space.md },
  editCard: { gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  timeBox: { width: 64, height: 44, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  timeBad: { borderColor: colors.danger || '#C0392B' },
  timeInput: { width: '100%', textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.ink, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  editMain: { flex: 1, gap: 3 },
  editName: { fontSize: 16, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  editMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editMeta: { fontSize: 12, fontWeight: '700', marginRight: space.sm },
  addNote: { fontSize: 12, fontWeight: '700', color: colors.accent },
  moveCol: { gap: 2 },
  moveBtn: { width: 34, height: 28, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  delBtn: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
  noteInput: { minHeight: 42, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, fontSize: 14, color: colors.ink },
  addRow: { flexDirection: 'row', gap: space.sm },
  addPlace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  addPlaceText: { fontSize: 15, fontWeight: '800', color: colors.accent },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, height: 50, borderRadius: radius.control, backgroundColor: colors.surfaceMuted },

  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, paddingHorizontal: space.xl, height: 46, borderRadius: radius.pill, backgroundColor: colors.accent },

  sheet: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  doneBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 46, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  chips: { gap: space.sm, paddingRight: space.lg, alignItems: 'center' },
  chipInline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: { paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextOn: { color: '#fff' },
  pickList: { gap: space.sm, paddingBottom: space.xl },
  newPlace: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.accentSoft },
  newPlaceText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  createBox: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  createTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  input: { height: 46, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, fontSize: 15, color: colors.ink },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  catPillText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  loader: { marginVertical: space.lg },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  pickRowPressed: { backgroundColor: colors.surfaceTint },
  catIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pickName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  pickSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sourceTabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  sourceTab: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sourceTabOn: { backgroundColor: colors.navy },
  countryBlock: { gap: space.sm },
  blockLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  chipTextDim: { color: colors.faint },
  otherPanel: { gap: space.sm, padding: space.sm, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  otherList: { maxHeight: 220 },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 11, paddingHorizontal: space.sm, borderRadius: radius.control },
  otherName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  otherCount: { fontSize: 12, fontWeight: '700', color: colors.muted },
  sourceTabText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  sourceTabTextOn: { color: '#fff' },
  saveWide: { height: 52, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  saveWideText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  rowDel: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  addedPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  addedPillText: { fontSize: 12, fontWeight: '700', color: colors.forest },
  doneBar: { paddingTop: space.sm },
  doneBarBtn: { height: 52, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneBarText: { fontSize: 16, fontWeight: '800', color: '#fff' }
});
