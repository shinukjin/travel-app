import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { StackPage } from '../components/StackPage';
import { useGuide } from '../GuideContext';
import { emergencyNumberFor } from '../countryInfo';
import { storage } from '../storage';
import { colors, radius, space } from '../theme';
import { Icon, TripLabel } from '../ui';

/** 한국 외교부 영사콜센터 (해외에서 24시간) */
const KOREA_CONSULAR_CALL = '+82-2-3210-0404';

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

/** 처음 열 때 채워 두는 항목 — 나라마다 달라지는 값은 비워 두어 직접 적게 한다 */
function defaultItems(trip) {
  return [
    { id: newId(), label: '현지 긴급전화', value: emergencyNumberFor(trip) },
    { id: newId(), label: '영사콜센터 (24시간)', value: KOREA_CONSULAR_CALL },
    { id: newId(), label: '현지 한국 대사관·영사관', value: '' },
    { id: newId(), label: '카드 분실 신고', value: '' },
    { id: newId(), label: '여행자 보험 긴급 연락처', value: '' },
    { id: newId(), label: '숙소 연락처', value: '' }
  ];
}

/** 값에서 첫 번째 전화번호만 뽑는다 (숫자 3개 이상). "110 (경찰) / 119" 는 110 */
function dialable(value) {
  const match = String(value || '').match(/\+?\d[\d\- ]*\d/);
  const number = match ? match[0].replace(/[\s-]/g, '') : '';
  return number.replace(/\D/g, '').length >= 3 ? number : '';
}

/** 인터넷 없이도 보이는 긴급 연락처 모음 — 여행마다 이 기기에 저장된다 */
export default function EmergencyScreen({ embed }) {
  const { trip } = useGuide();
  const [items, setItems] = useState(null);
  const itemsRef = useRef(null);
  const tripId = trip?.id;

  useEffect(() => {
    let active = true;
    setItems(null);
    if (!tripId) return undefined;
    (async () => {
      const all = await storage.getEmergency();
      const list = all[tripId] || defaultItems(trip);
      if (!all[tripId]) await storage.setEmergency({ ...all, [tripId]: list });
      if (active) {
        itemsRef.current = list;
        setItems(list);
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId]);

  async function persist(next) {
    itemsRef.current = next;
    setItems(next);
    const all = await storage.getEmergency();
    await storage.setEmergency({ ...all, [tripId]: next });
  }

  const patch = (id, change) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...change } : it)));
  const saveCurrent = () => persist(items);
  const add = () => persist([...(items || []), { id: newId(), label: '', value: '' }]);
  const remove = (id) => persist(items.filter((it) => it.id !== id));

  if (!trip) {
    return (
      <StackPage title="긴급 정보" contentStyle={styles.body} embed={embed}>
        <View style={styles.empty}>
          <Icon name="shield-checkmark-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>여행을 먼저 만들어 주세요</Text>
          <Text style={styles.emptyText}>여행마다 긴급 연락처를 따로 모아 둘 수 있어요.</Text>
        </View>
      </StackPage>
    );
  }

  return (
    <StackPage title="긴급 정보" contentStyle={styles.body} embed={embed}>
      <TripLabel trip={trip} />
      <Text style={styles.lead}>여행 전에 적어 두면 인터넷이 없어도 바로 열어 전화할 수 있어요. 이 기기에만 저장돼요.</Text>

      {(items || []).map((item) => {
        const tel = dialable(item.value);
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <TextInput
                style={styles.label}
                value={item.label}
                onChangeText={(t) => patch(item.id, { label: t })}
                onBlur={saveCurrent}
                placeholder="항목 이름"
                placeholderTextColor={colors.faint}
              />
              <Pressable onPress={() => remove(item.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${item.label || '항목'} 삭제`}>
                <Icon name="close" size={18} color={colors.faint} />
              </Pressable>
            </View>
            <View style={styles.valueRow}>
              <TextInput
                style={styles.value}
                value={item.value}
                onChangeText={(t) => patch(item.id, { value: t })}
                onBlur={saveCurrent}
                placeholder="번호나 내용을 적어 주세요"
                placeholderTextColor={colors.faint}
                multiline
              />
              {tel ? (
                <Pressable onPress={() => Linking.openURL(`tel:${tel}`)} style={styles.call} accessibilityRole="button" accessibilityLabel={`${item.label} 전화 걸기`}>
                  <Icon name="call" size={18} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <Pressable onPress={add} style={styles.add} accessibilityRole="button">
        <Icon name="add" size={20} color={colors.accent} />
        <Text style={styles.addText}>항목 추가</Text>
      </Pressable>
    </StackPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  lead: { fontSize: 13, lineHeight: 19, color: colors.muted },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.muted, paddingVertical: 0 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  value: { flex: 1, minHeight: 36, fontSize: 18, fontWeight: '700', color: colors.ink, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  call: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.accentSoft },
  addText: { fontSize: 15, fontWeight: '800', color: colors.accent },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.sheet, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }
});
