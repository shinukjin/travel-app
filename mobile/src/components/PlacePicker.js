import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { geocodeQuery } from '../maps/geocode';
import { categoryMeta, colors, radius, space } from '../theme';
import { countryFlag, countryLabel, parseCountries } from '../countries';
import { Icon } from '../ui';

const CATEGORY_FILTERS = [{ id: 'ALL', label: '전체', icon: null }, ...Object.entries(categoryMeta).map(([id, m]) => ({ id, label: m.label, icon: m.icon, color: m.color }))];

/** 오른쪽 상태 알약: 담기 / 추가됨 / 진행 중 */
function AddPill({ state }) {
  if (state === 'busy') return <ActivityIndicator size="small" color={colors.accent} />;
  if (state === 'added') {
    return (
      <View style={[styles.pill, styles.pillDone]}>
        <Icon name="checkmark" size={14} color={colors.forest} />
        <Text style={[styles.pillText, { color: colors.forest }]}>추가됨</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillAdd]}>
      <Icon name="add" size={14} color="#fff" />
      <Text style={[styles.pillText, { color: '#fff' }]}>담기</Text>
    </View>
  );
}

/**
 * 장소 추가 화면
 * - 추천 관광지: 나라 → 도시 → 분류로 좁혀서 한 번에 담기
 * - 내 장소: 검색해서 담기, 없으면 바로 만들기
 * 삭제는 여기서 바로 하지 않고 onDelete 로 넘겨, 일정 저장 때 한 번만 확인한다.
 */
export default function PlacePicker({ visible, onClose, onPick, onDelete, onUndoDelete, addedCount, addedIds, pendingDelete, tripCountry }) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('catalog');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('ALL');

  // 좌우로 밀면 추천 관광지 <-> 내 장소 전환
  const sourceRef = useRef('catalog');
  sourceRef.current = source;
  const slide = useRef(new Animated.Value(0)).current;
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 60 && Math.abs(g.vx) < 0.5) return;
        const next = g.dx < 0 ? 'mine' : 'catalog'; // 왼쪽으로 밀면 내 장소, 오른쪽으로 밀면 추천
        if (next === sourceRef.current) return;
        setSource(next);
        slide.setValue(g.dx < 0 ? 40 : -40);
        Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      }
    })
  ).current;

  // 내 장소
  const [places, setPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [nameLocal, setNameLocal] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('SIGHT');
  const [saving, setSaving] = useState(false);

  // 추천 관광지
  const [catCountries, setCatCountries] = useState([]);
  const [catCountry, setCatCountry] = useState('');
  const [catCities, setCatCities] = useState([]);
  const [catCity, setCatCity] = useState('');
  const [catRows, setCatRows] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catBusyId, setCatBusyId] = useState(null);
  const [showOther, setShowOther] = useState(false);
  const [otherQuery, setOtherQuery] = useState('');

  const tripCodes = useMemo(() => parseCountries(tripCountry), [tripCountry]);
  const countMap = useMemo(() => Object.fromEntries(catCountries.map((c) => [c.country, c.count])), [catCountries]);
  const otherSelected = !!catCountry && !tripCodes.includes(catCountry);
  const otherList = useMemo(() => {
    const q = otherQuery.trim().toLowerCase();
    return catCountries.filter((c) => !q || c.country.toLowerCase().includes(q) || countryLabel(c.country).toLowerCase().includes(q));
  }, [catCountries, otherQuery]);

  // 열 때마다 내 장소를 새로 읽는다
  useEffect(() => {
    if (!visible) return;
    setLoadingPlaces(true);
    api
      .places()
      .then(setPlaces)
      .catch(() => Alert.alert('장소를 불러오지 못했어요', '네트워크 연결을 확인해 주세요.'))
      .finally(() => setLoadingPlaces(false));
  }, [visible]);

  // 나라 목록 (처음 한 번) — 이 여행의 나라 중 데이터가 있는 곳으로 시작
  useEffect(() => {
    if (!visible || source !== 'catalog' || catCountries.length) return;
    api
      .catalogCountries()
      .then((list) => {
        const rows = list || [];
        setCatCountries(rows);
        const withData = tripCodes.find((c) => rows.some((x) => x.country === c));
        setCatCountry(withData || tripCodes[0] || '');
      })
      .catch(() => {});
  }, [visible, source]);

  useEffect(() => {
    setCatCity('');
    setCatCities([]);
    if (!visible || source !== 'catalog' || !catCountry) return undefined;
    let cancelled = false;
    api
      .catalogCities(catCountry)
      .then((list) => {
        if (!cancelled) setCatCities(list || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, source, catCountry]);

  useEffect(() => {
    if (!visible || source !== 'catalog') return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCatLoading(true);
      try {
        const rows = await api.catalogSearch({ country: catCountry, city: catCity, q: query, category: cat === 'ALL' ? '' : cat, limit: 60 });
        if (!cancelled) setCatRows(rows);
      } catch {
        if (!cancelled) setCatRows([]);
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, source, catCountry, catCity, query, cat]);

  const pendingIds = pendingDelete || new Set();
  const myPlaces = useMemo(() => places.filter((p) => !pendingIds.has(p.id)), [places, pendingDelete]);
  const catalogAdded = useMemo(() => {
    const ids = new Set();
    for (const p of places) if (p.catalogId && addedIds.has(p.id)) ids.add(p.catalogId);
    return ids;
  }, [places, addedIds]);
  const importedCatalog = useMemo(() => new Set(myPlaces.map((p) => p.catalogId).filter(Boolean)), [myPlaces]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set();
    return myPlaces.filter((p) => {
      const sig = `${p.name}|${p.address || ''}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      if (cat !== 'ALL' && p.category !== cat) return false;
      if (!q) return true;
      return [p.name, p.nameLocal, p.address].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [myPlaces, query, cat]);

  // 도시 전체 보기일 때는 도시별로 묶어 보여준다
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of catRows) {
      const key = r.city || '기타';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()];
  }, [catRows]);
  const showGroupHeads = !catCity && groups.length > 1;

  async function pickCatalog(item) {
    setCatBusyId(item.id);
    try {
      const place = await api.importCatalogPlace(item.id);
      setPlaces((list) => (list.some((p) => p.id === place.id) ? list : [place, ...list]));
      onPick(place);
    } catch (e) {
      Alert.alert('담지 못했어요', e.message || '네트워크 연결을 확인해 주세요.');
    } finally {
      setCatBusyId(null);
    }
  }

  async function createAndPick() {
    const n = name.trim();
    if (!n) {
      Alert.alert('장소 이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      // 현지 이름·주소로 좌표를 찾아 지도에도 표시되게 한다 (못 찾아도 장소는 만든다)
      const hit = await geocodeQuery([nameLocal.trim() || n, address.trim()].filter(Boolean).join(' '));
      const created = await api.createPlace({
        name: n,
        nameLocal: nameLocal.trim() || null,
        category,
        address: address.trim() || hit?.address || null,
        lat: hit ? hit.lat : null,
        lng: hit ? hit.lng : null,
        memo: null
      });
      setPlaces((list) => [created, ...list]);
      onPick(created);
      setName('');
      setNameLocal('');
      setAddress('');
      setCategory('SIGHT');
      setCreating(false);
    } catch (e) {
      Alert.alert('장소 저장 실패', e.message);
    } finally {
      setSaving(false);
    }
  }

  function startCreate(prefill) {
    if (prefill && !name) setName(prefill);
    setSource('mine');
    setCreating(true);
  }

  const q = query.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Math.max(insets.top, space.md), paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {/* 고정 영역: 제목 · 탭 · 검색 */}
        <View style={styles.head}>
          <Text style={styles.title}>장소 추가</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {[
            { id: 'catalog', label: '추천 관광지' },
            { id: 'mine', label: `내 장소${myPlaces.length ? ` ${myPlaces.length}` : ''}` }
          ].map((t) => {
            const on = t.id === source;
            return (
              <Pressable key={t.id} onPress={() => setSource(t.id)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={source === 'catalog' ? '관광지·맛집 이름 검색' : '내 장소 검색'}
            placeholderTextColor={colors.faint}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="검색어 지우기">
              <Icon name="close-circle" size={18} color={colors.faint} />
            </Pressable>
          ) : null}
        </View>

        {/* 스크롤 영역: 필터가 목록과 함께 올라가 목록이 넓게 보인다 */}
        <Animated.View style={[styles.flex1, { transform: [{ translateX: slide }] }]} {...swipe.panHandlers}>
        <ScrollView style={styles.flex1} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {source === 'catalog' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chips}>
                {tripCodes.map((code) => {
                  const on = catCountry === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => {
                        setCatCountry(code);
                        setShowOther(false);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn, !countMap[code] && !on && styles.dim]}>
                        {countryFlag(code)} {countryLabel(code)}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setShowOther((v) => !v)} style={[styles.chip, styles.chipRow, (otherSelected || showOther) && styles.chipOn]} accessibilityRole="button">
                  <Icon name="globe-outline" size={14} color={otherSelected || showOther ? '#fff' : colors.muted} />
                  <Text style={[styles.chipText, (otherSelected || showOther) && styles.chipTextOn]}>
                    {otherSelected ? `${countryFlag(catCountry)} ${countryLabel(catCountry)}` : '다른 나라'}
                  </Text>
                  <Icon name={showOther ? 'chevron-up' : 'chevron-down'} size={14} color={otherSelected || showOther ? '#fff' : colors.muted} />
                </Pressable>
              </ScrollView>

              {showOther ? (
                <View style={styles.otherPanel}>
                  <View style={[styles.search, styles.searchSm]}>
                    <Icon name="search" size={16} color={colors.faint} />
                    <TextInput style={styles.searchInput} value={otherQuery} onChangeText={setOtherQuery} placeholder="나라 검색 (예: 일본, 프랑스)" placeholderTextColor={colors.faint} />
                  </View>
                  <ScrollView style={styles.otherList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    <Pressable
                      onPress={() => {
                        setCatCountry('');
                        setShowOther(false);
                      }}
                      style={styles.otherRow}
                    >
                      <Text style={styles.otherName}>🌍 전체 나라</Text>
                      {!catCountry ? <Icon name="checkmark" size={18} color={colors.accent} /> : null}
                    </Pressable>
                    {otherList.map((c) => (
                      <Pressable
                        key={c.country}
                        onPress={() => {
                          setCatCountry(c.country);
                          setShowOther(false);
                        }}
                        style={styles.otherRow}
                      >
                        <Text style={styles.otherName}>
                          {countryFlag(c.country)} {countryLabel(c.country)}
                          {tripCodes.includes(c.country) ? '  · 여행 나라' : ''}
                        </Text>
                        <Text style={styles.otherCount}>{c.count}</Text>
                        {catCountry === c.country ? <Icon name="checkmark" size={18} color={colors.accent} /> : null}
                      </Pressable>
                    ))}
                    {!otherList.length ? <Text style={styles.empty}>등록된 나라가 없어요.</Text> : null}
                  </ScrollView>
                </View>
              ) : null}

              {catCountry && catCities.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chips}>
                  <Pressable onPress={() => setCatCity('')} style={[styles.cityChip, !catCity && styles.cityChipOn]}>
                    <Text style={[styles.cityText, !catCity && styles.cityTextOn]}>전체 도시</Text>
                  </Pressable>
                  {catCities.map((city) => {
                    const on = catCity === city;
                    return (
                      <Pressable key={city} onPress={() => setCatCity(on ? '' : city)} style={[styles.cityChip, on && styles.cityChipOn]}>
                        <Text style={[styles.cityText, on && styles.cityTextOn]}>{city}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chips}>
            {CATEGORY_FILTERS.map((c) => {
              const on = c.id === cat;
              return (
                <Pressable key={c.id} onPress={() => setCat(c.id)} style={[styles.catChip, on && styles.catChipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  {c.icon ? <Icon name={c.icon} size={13} color={on ? '#fff' : c.color} /> : null}
                  <Text style={[styles.catChipText, on && styles.chipTextOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {source === 'catalog' ? (
            <>
              {catLoading && !catRows.length ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
              {groups.map(([city, rows]) => (
                <View key={city} style={styles.group}>
                  {showGroupHeads ? (
                    <Text style={styles.groupHead}>
                      {city} <Text style={styles.groupCount}>{rows.length}</Text>
                    </Text>
                  ) : null}
                  {rows.map((item) => {
                    const meta = categoryMeta[item.category] || categoryMeta.SIGHT;
                    const added = catalogAdded.has(item.id);
                    const busy = catBusyId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => pickCatalog(item)}
                        disabled={busy || added}
                        style={({ pressed }) => [styles.row, added && styles.rowAdded, pressed && styles.rowPressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} 일정에 담기`}
                      >
                        <View style={[styles.catIcon, { backgroundColor: meta.soft }]}>
                          <Icon name={meta.icon} size={18} color={meta.color} />
                        </View>
                        <View style={styles.flex1}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.rowSub} numberOfLines={1}>
                            {[item.nameLocal, !catCity && !showGroupHeads ? item.city : '', meta.label].filter(Boolean).join(' · ')}
                          </Text>
                          {item.memo ? (
                            <Text style={styles.rowMemo} numberOfLines={2}>
                              {item.memo}
                            </Text>
                          ) : null}
                        </View>
                        <AddPill state={busy ? 'busy' : added ? 'added' : 'add'} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {!catLoading && !catRows.length ? (
                <View style={styles.emptyBox}>
                  <Icon name="compass-outline" size={26} color={colors.muted} />
                  <Text style={styles.emptyTitle}>
                    {q ? `'${q}' 결과가 없어요` : catCountry && !countMap[catCountry] ? `아직 ${countryLabel(catCountry)} 추천 관광지가 없어요` : '조건에 맞는 관광지가 없어요'}
                  </Text>
                  <Text style={styles.empty}>다른 나라를 고르거나 직접 만들어 담을 수 있어요.</Text>
                </View>
              ) : null}

              <Pressable onPress={() => startCreate(q)} style={styles.createRow} accessibilityRole="button">
                <Icon name="create-outline" size={18} color={colors.accent} />
                <Text style={styles.createRowText} numberOfLines={1}>
                  {q ? `찾는 곳이 없으면 '${q}' 직접 만들기` : '찾는 곳이 없나요? 직접 만들기'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {pendingIds.size ? (
                <View style={styles.undoBar}>
                  <Text style={styles.undoText}>{pendingIds.size}곳 삭제 예정 · 일정을 저장하면 삭제돼요</Text>
                  <Pressable onPress={onUndoDelete} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.undoBtn}>되돌리기</Text>
                  </Pressable>
                </View>
              ) : null}

              {creating ? (
                <View style={styles.createBox}>
                  <Text style={styles.createTitle}>새 장소 만들기</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="장소 이름" placeholderTextColor={colors.faint} autoFocus />
                  <TextInput style={styles.input} value={nameLocal} onChangeText={setNameLocal} placeholder="현지 이름 (선택, 지도 검색에 사용)" placeholderTextColor={colors.faint} />
                  <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="주소 (선택)" placeholderTextColor={colors.faint} />
                  <View style={styles.catRow}>
                    {Object.entries(categoryMeta).map(([id, m]) => {
                      const on = id === category;
                      return (
                        <Pressable key={id} onPress={() => setCategory(id)} style={[styles.catPill, on && { backgroundColor: m.color }]}>
                          <Icon name={m.icon} size={14} color={on ? '#fff' : m.color} />
                          <Text style={[styles.catPillText, on && styles.chipTextOn]}>{m.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.hint}>이름과 주소로 위치를 자동으로 찾아 지도에 표시해요.</Text>
                  <View style={styles.btnRow}>
                    <Pressable onPress={() => setCreating(false)} style={styles.btnGhost}>
                      <Text style={styles.btnGhostText}>취소</Text>
                    </Pressable>
                    <Pressable onPress={createAndPick} disabled={saving} style={[styles.btnPrimary, saving && styles.dimBtn]}>
                      <Text style={styles.btnPrimaryText}>{saving ? '위치 찾는 중…' : '만들고 담기'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => startCreate(q)} style={styles.newPlace} accessibilityRole="button">
                  <Icon name="add-circle" size={20} color={colors.accent} />
                  <Text style={styles.newPlaceText} numberOfLines={1}>
                    {q ? `'${q}' 새 장소로 만들기` : '새 장소 직접 만들기'}
                  </Text>
                </Pressable>
              )}

              {loadingPlaces ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
              {filtered.map((place) => {
                const meta = categoryMeta[place.category] || categoryMeta.SIGHT;
                const added = addedIds.has(place.id);
                return (
                  <Pressable
                    key={place.id}
                    onPress={() => onPick(place)}
                    disabled={added}
                    style={({ pressed }) => [styles.row, added && styles.rowAdded, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${place.name} 일정에 담기`}
                  >
                    <View style={[styles.catIcon, { backgroundColor: meta.soft }]}>
                      <Icon name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {[place.nameLocal, place.address, meta.label].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <AddPill state={added ? 'added' : 'add'} />
                    {!added ? (
                      <Pressable onPress={() => onDelete(place)} hitSlop={8} style={styles.delBtn} accessibilityRole="button" accessibilityLabel={`${place.name} 삭제`}>
                        <Icon name="trash-outline" size={17} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
              {!loadingPlaces && !filtered.length && !creating ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>{myPlaces.length ? '조건에 맞는 장소가 없어요' : '아직 내 장소가 없어요'}</Text>
                  <Text style={styles.empty}>{myPlaces.length ? '검색어나 분류를 바꿔 보세요.' : '추천 관광지에서 담거나 직접 만들어 보세요.'}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
        </Animated.View>

        <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
          <Text style={styles.doneText}>{addedCount ? `${addedCount}곳 담았어요 · 완료` : '닫기'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  noGrow: { flexGrow: 0 },
  sheet: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tab: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.navy },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  tabTextOn: { color: '#fff' },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 48, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  searchSm: { height: 42 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },

  list: { gap: space.md, paddingBottom: space.lg },
  chips: { gap: space.sm, paddingRight: space.lg, alignItems: 'center' },
  chip: { paddingHorizontal: space.md, height: 38, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  chipTextOn: { color: '#fff' },
  dim: { color: colors.faint },
  cityChip: { paddingHorizontal: space.md, height: 34, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  cityChipOn: { backgroundColor: colors.accent },
  cityText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  cityTextOn: { color: '#fff' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.md, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  catChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  catChipText: { fontSize: 13, fontWeight: '700', color: colors.ink },

  otherPanel: { gap: space.sm, padding: space.sm, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  otherList: { maxHeight: 240 },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12, paddingHorizontal: space.sm, borderRadius: radius.control },
  otherName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  otherCount: { fontSize: 12, fontWeight: '700', color: colors.muted },

  group: { gap: space.sm },
  groupHead: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: space.xs },
  groupCount: { fontSize: 13, fontWeight: '700', color: colors.faint },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 64, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  rowAdded: { backgroundColor: colors.surfaceTint },
  rowPressed: { backgroundColor: colors.surfaceTint },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowMemo: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, height: 32, borderRadius: radius.pill },
  pillAdd: { backgroundColor: colors.accent },
  pillDone: { backgroundColor: colors.forestSoft },
  pillText: { fontSize: 13, fontWeight: '800' },
  delBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  loader: { marginVertical: space.lg },
  emptyBox: { alignItems: 'center', gap: 6, paddingVertical: space.xl },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  empty: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  createRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent },
  createRowText: { fontSize: 14, fontWeight: '700', color: colors.accent, flexShrink: 1 },

  undoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, padding: space.md, borderRadius: radius.control, backgroundColor: colors.tramSoft },
  undoText: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18 },
  undoBtn: { fontSize: 14, fontWeight: '800', color: colors.accent },

  newPlace: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.accentSoft },
  newPlaceText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.accent },
  createBox: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  createTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  input: { height: 46, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, fontSize: 15, color: colors.ink },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  catPillText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  btnGhost: { paddingHorizontal: space.lg, height: 44, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  btnPrimary: { paddingHorizontal: space.lg, height: 44, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dimBtn: { opacity: 0.5 },

  doneBtn: { height: 52, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 16, fontWeight: '800', color: '#fff' }
});
