import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { searchPlaces } from '../maps/geocode';
import ExploreMap from './ExploreMap';
import { categoryMeta, colors, radius, space } from '../theme';
import { countryFlag, countryLabel, parseCountries, searchCountries } from '../countries';
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
  const [source, setSource] = useState('mine');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('ALL');

  // 좌우로 밀면 내 장소 <-> 추천 관광지 전환 (탭 순서: 내 장소 · 추천 관광지)
  const sourceRef = useRef('mine');
  sourceRef.current = source;
  const slide = useRef(new Animated.Value(0)).current;
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 60 && Math.abs(g.vx) < 0.5) return;
        const next = g.dx < 0 ? 'catalog' : 'mine'; // 왼쪽으로 밀면 오른쪽 탭(추천), 오른쪽으로 밀면 왼쪽 탭(내 장소)
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
  // 새 장소 만들 때 위치 확인: 검색어 · 후보 목록(null = 아직 검색 안 함) · 진행 중 · 오류 · 사용자가 고른 후보
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [chosen, setChosen] = useState(null);
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
  // 추천 관광지가 등록된 나라만이 아니라 모든 나라를 고를 수 있게 한다 (등록된 나라는 위로, 개수 표시)
  const otherList = useMemo(() => {
    const all = searchCountries(otherQuery).map((c) => ({ country: c.code, count: countMap[c.code] || 0 }));
    return [...all.filter((c) => c.count > 0), ...all.filter((c) => c.count === 0)];
  }, [countMap, otherQuery]);

  // 열 때마다 내 장소를 새로 읽는다
  useEffect(() => {
    if (!visible) return;
    setSource('mine'); // 열 때는 항상 "내 장소" 탭부터
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

  // 웹(Google Places)에서 바로 찾기 — 누를 때만 호출한다
  const [webRows, setWebRows] = useState(null);
  const [webBusy, setWebBusy] = useState(false);
  const [webError, setWebError] = useState('');
  const [webAddingId, setWebAddingId] = useState(null);
  const [webAdded, setWebAdded] = useState(() => new Set());
  const CAT_WORD = { ALL: '인기 관광지', SIGHT: '인기 관광지', FOOD: '맛집', STAY: '숙소', TRANSIT: '역 공항' };
  const webPlaceName = [catCity, catCountry ? countryLabel(catCountry) : ''].filter(Boolean).join(' ');
  const webQuery = `${webPlaceName} ${query.trim() || CAT_WORD[cat] || CAT_WORD.ALL}`.trim();

  // 나라·도시·검색어·분류가 바뀌면 이전 웹 검색 결과는 지운다
  useEffect(() => {
    setWebRows(null);
    setWebError('');
  }, [catCountry, catCity, query, cat, source]);

  async function searchWeb() {
    if (webBusy) return;
    setWebBusy(true);
    setWebError('');
    try {
      setWebRows(await searchPlaces(webQuery, 15));
    } catch (e) {
      setWebRows([]);
      setWebError(e.message || '웹에서 찾지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setWebBusy(false);
    }
  }

  /** 웹에서 찾은 장소를 내 장소로 저장하고 일정에 담는다 (좌표 포함) */
  async function pickWeb(item) {
    setWebAddingId(item.id);
    try {
      const created = await api.createPlace({
        name: item.name,
        nameLocal: null,
        category: cat === 'ALL' ? 'SIGHT' : cat,
        address: item.address || null,
        lat: item.lat,
        lng: item.lng,
        memo: null
      });
      setPlaces((list) => [created, ...list]);
      setWebAdded((s) => new Set(s).add(item.id));
      onPick(created);
    } catch (e) {
      Alert.alert('담지 못했어요', e.message || '네트워크 연결을 확인해 주세요.');
    } finally {
      setWebAddingId(null);
    }
  }

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

  /** 위치 검색 — 후보를 최대 5개 보여 주고, 사용자가 하나를 골라 좌표를 확인한다 */
  async function runGeoSearch(text = geoQuery) {
    const t = String(text || '').trim();
    if (!t) return;
    setGeoBusy(true);
    setGeoError('');
    setChosen(null);
    try {
      setGeoResults(await searchPlaces(t, 5));
    } catch (e) {
      setGeoResults([]);
      setGeoError(e.message || '장소 검색에 실패했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setGeoBusy(false);
    }
  }

  /** 후보 선택 — 이름·주소가 비어 있으면 채워 준다 */
  function chooseGeo(place) {
    setChosen(place);
    if (!name.trim() && place.name) setName(place.name);
    if (!address.trim() && place.address) setAddress(place.address);
  }

  function resetCreate() {
    setName('');
    setNameLocal('');
    setAddress('');
    setCategory('SIGHT');
    setGeoQuery('');
    setGeoResults(null);
    setGeoError('');
    setChosen(null);
    setCreating(false);
  }

  function cancelCreate() {
    resetCreate();
  }

  /** 확인한 좌표로 장소를 저장한다. withoutLocation=true 면 좌표 없이 이름만 저장 */
  async function createAndPick(withoutLocation) {
    const n = name.trim() || chosen?.name || '';
    if (!n) {
      Alert.alert('장소 이름을 입력해 주세요.');
      return;
    }
    if (!chosen && !withoutLocation) {
      Alert.alert('위치를 먼저 확인해 주세요', '장소 이름이나 주소를 검색해서 후보를 골라 주세요.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.createPlace({
        name: n,
        nameLocal: nameLocal.trim() || null,
        category,
        address: address.trim() || chosen?.address || null,
        lat: chosen ? chosen.lat : null,
        lng: chosen ? chosen.lng : null,
        memo: null
      });
      setPlaces((list) => [created, ...list]);
      onPick(created);
      resetCreate();
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
    // 검색창에 적어 둔 이름이 있으면 바로 위치를 찾아 보여 준다
    if (prefill) {
      setGeoQuery(prefill);
      runGeoSearch(prefill);
    }
  }

  const q = query.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Math.max(insets.top, space.md), paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {/* 고정 영역: 제목 · 탭 · 검색 */}
        <View style={styles.head}>
          <Text style={styles.title}>장소 추가</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={20} color={colors.accentDark} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {[
            { id: 'mine', label: `내 장소${myPlaces.length ? ` ${myPlaces.length}` : ''}` },
            { id: 'catalog', label: '추천 관광지' }
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
                  <Icon name="globe-outline" size={14} color={otherSelected || showOther ? colors.accentDark : colors.muted} />
                  <Text style={[styles.chipText, (otherSelected || showOther) && styles.chipTextOn]}>
                    {otherSelected ? `${countryFlag(catCountry)} ${countryLabel(catCountry)}` : '다른 나라'}
                  </Text>
                  <Icon name={showOther ? 'chevron-up' : 'chevron-down'} size={14} color={otherSelected || showOther ? colors.accentDark : colors.muted} />
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
                        <Text style={[styles.otherCount, !c.count && styles.dim]}>{c.count ? c.count : '준비 중'}</Text>
                        {catCountry === c.country ? <Icon name="checkmark" size={18} color={colors.accent} /> : null}
                      </Pressable>
                    ))}
                    {!otherList.length ? <Text style={styles.empty}>검색한 나라가 없어요.</Text> : null}
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
                  {c.icon ? <Icon name={c.icon} size={13} color={on ? colors.accentDark : c.color} /> : null}
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

              {/* 등록된 추천이 부족하면 웹(Google 지도)에서 바로 찾는다 */}
              <Pressable
                onPress={searchWeb}
                disabled={webBusy}
                style={({ pressed }) => [styles.createRow, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="웹에서 장소 찾기"
              >
                {webBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Icon name="globe-outline" size={18} color={colors.accent} />}
                <Text style={styles.createRowText} numberOfLines={1}>
                  {webBusy ? '웹에서 찾는 중…' : `웹에서 '${webQuery}' 찾기`}
                </Text>
              </Pressable>
              {webError ? <Text style={styles.webError}>{webError}</Text> : null}
              {webRows && !webRows.length && !webError ? <Text style={styles.empty}>웹에서도 찾지 못했어요. 검색어를 바꿔 보세요.</Text> : null}
              {webRows?.length ? (
                <View style={styles.group}>
                  <Text style={styles.groupHead}>
                    웹 검색 결과 <Text style={styles.groupCount}>{webRows.length}</Text>
                  </Text>
                  {webRows.map((item) => {
                    const meta = categoryMeta[cat === 'ALL' ? 'SIGHT' : cat] || categoryMeta.SIGHT;
                    const busy = webAddingId === item.id;
                    const added = webAdded.has(item.id);
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => pickWeb(item)}
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
                            {item.address}
                          </Text>
                        </View>
                        <AddPill state={busy ? 'busy' : added ? 'added' : 'add'} />
                      </Pressable>
                    );
                  })}
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

                  {/* 1) 위치 검색 → 후보 선택 → 좌표 확인 */}
                  <Text style={styles.stepLabel}>1. 위치 찾기</Text>
                  <View style={styles.geoRow}>
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={geoQuery}
                      onChangeText={setGeoQuery}
                      placeholder="장소 이름이나 주소 (예: 사그라다 파밀리아)"
                      placeholderTextColor={colors.faint}
                      returnKeyType="search"
                      onSubmitEditing={() => runGeoSearch()}
                      autoFocus
                    />
                    <Pressable onPress={() => runGeoSearch()} disabled={geoBusy || !geoQuery.trim()} style={[styles.geoBtn, (geoBusy || !geoQuery.trim()) && styles.dimBtn]} accessibilityRole="button" accessibilityLabel="위치 검색">
                      {geoBusy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="search" size={18} color="#fff" />}
                    </Pressable>
                  </View>

                  {geoError ? <Text style={styles.geoError}>{geoError}</Text> : null}
                  {geoResults && !geoResults.length && !geoError && !geoBusy ? (
                    <Text style={styles.hint}>검색 결과가 없어요. 현지 이름이나 도시를 함께 적어 보세요. (예: 센소지 도쿄)</Text>
                  ) : null}
                  {!chosen && geoResults?.length
                    ? geoResults.map((p) => (
                        <Pressable key={p.id} onPress={() => chooseGeo(p)} style={({ pressed }) => [styles.geoItem, pressed && styles.geoItemOn]} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.address}`}>
                          <View style={styles.geoPin}>
                            <Icon name="location" size={16} color={colors.accent} />
                          </View>
                          <View style={styles.flex1}>
                            <Text style={styles.geoName} numberOfLines={1}>
                              {p.name || p.address}
                            </Text>
                            {p.address ? (
                              <Text style={styles.geoAddr} numberOfLines={2}>
                                {p.address}
                              </Text>
                            ) : null}
                          </View>
                          <Icon name="chevron-forward" size={16} color={colors.faint} />
                        </Pressable>
                      ))
                    : null}

                  {/* 선택한 위치 확인 — 좌표와 미리보기 지도 */}
                  {chosen ? (
                    <View style={styles.chosenBox}>
                      <View style={styles.chosenHead}>
                        <Icon name="checkmark-circle" size={20} color={colors.forest} />
                        <Text style={styles.chosenTitle}>위치를 확인했어요</Text>
                        <View style={styles.flex1} />
                        <Pressable onPress={() => setChosen(null)} hitSlop={8} accessibilityRole="button">
                          <Text style={styles.chosenRetry}>다시 찾기</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.chosenName} numberOfLines={2}>
                        {chosen.name || chosen.address}
                      </Text>
                      {chosen.name && chosen.address ? (
                        <Text style={styles.geoAddr} numberOfLines={2}>
                          {chosen.address}
                        </Text>
                      ) : null}
                      <Text style={styles.chosenCoord}>
                        좌표 {chosen.lat.toFixed(5)}, {chosen.lng.toFixed(5)}
                      </Text>
                      <View style={styles.mapBox}>
                        <ExploreMap compact places={[]} center={{ lat: chosen.lat, lng: chosen.lng, label: chosen.name || '선택한 위치' }} />
                      </View>
                    </View>
                  ) : null}

                  {/* 2) 이름·분류 */}
                  <Text style={styles.stepLabel}>2. 이름과 분류</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="장소 이름" placeholderTextColor={colors.faint} />
                  <TextInput style={styles.input} value={nameLocal} onChangeText={setNameLocal} placeholder="현지 이름 (선택)" placeholderTextColor={colors.faint} />
                  <View style={styles.catRow}>
                    {Object.entries(categoryMeta).map(([id, m]) => {
                      const on = id === category;
                      return (
                        <Pressable key={id} onPress={() => setCategory(id)} style={[styles.catPill, on && { backgroundColor: m.soft }]}>
                          <Icon name={m.icon} size={14} color={m.color} />
                          <Text style={[styles.catPillText, on && styles.chipTextOn]}>{m.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.hint}>{chosen ? '확인한 좌표가 저장돼서 지도 핀과 이동 시간이 나와요.' : '위치를 찾아 고르면 좌표가 저장돼서 지도에 표시돼요.'}</Text>
                  <View style={styles.btnRow}>
                    <Pressable onPress={cancelCreate} style={styles.btnGhost}>
                      <Text style={styles.btnGhostText}>취소</Text>
                    </Pressable>
                    <Pressable onPress={() => createAndPick(false)} disabled={saving || !chosen} style={[styles.btnPrimary, (saving || !chosen) && styles.dimBtn]} accessibilityRole="button">
                      <Text style={styles.btnPrimaryText}>{saving ? '저장 중…' : '만들고 담기'}</Text>
                    </Pressable>
                  </View>
                  {!chosen ? (
                    <Pressable onPress={() => createAndPick(true)} disabled={saving || !name.trim()} style={styles.noLoc} accessibilityRole="button">
                      <Text style={[styles.noLocText, !name.trim() && styles.dimBtn]}>위치 없이 이름만 저장</Text>
                    </Pressable>
                  ) : null}
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
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tab: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.card },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  tabTextOn: { color: colors.accentDark },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 48, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  searchSm: { height: 42 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },

  list: { gap: space.md, paddingBottom: space.lg },
  chips: { gap: space.sm, paddingRight: space.lg, alignItems: 'center' },
  chip: { paddingHorizontal: space.md, height: 38, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  chipTextOn: { color: colors.accentDark },
  dim: { color: colors.faint },
  webError: { color: colors.danger, fontSize: 13, lineHeight: 19, paddingHorizontal: space.xs },
  cityChip: { paddingHorizontal: space.md, height: 34, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  cityChipOn: { backgroundColor: colors.accent },
  cityText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  cityTextOn: { color: '#fff' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.md, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  catChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
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
  stepLabel: { fontSize: 13, fontWeight: '800', color: colors.accentDark, marginTop: space.xs },
  geoRow: { flexDirection: 'row', gap: space.sm },
  geoBtn: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  geoError: { fontSize: 13, fontWeight: '600', color: colors.danger, lineHeight: 18 },
  geoItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: 8, paddingHorizontal: space.sm, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  geoItemOn: { backgroundColor: colors.accentSoft },
  geoPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  geoName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  geoAddr: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  chosenBox: { gap: 4, padding: space.md, borderRadius: radius.card, backgroundColor: colors.forestSoft },
  chosenHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chosenTitle: { fontSize: 14, fontWeight: '800', color: colors.forestInk },
  chosenRetry: { fontSize: 13, fontWeight: '700', color: colors.accentDark },
  chosenName: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 2 },
  chosenCoord: { fontSize: 12, fontWeight: '600', color: colors.forestInk, fontVariant: ['tabular-nums'] },
  mapBox: { height: 220, borderRadius: radius.control, overflow: 'hidden', marginTop: space.xs },
  noLoc: { alignSelf: 'center', paddingVertical: space.sm },
  noLocText: { fontSize: 13, fontWeight: '700', color: colors.muted, textDecorationLine: 'underline' },
  btnRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  btnGhost: { paddingHorizontal: space.lg, height: 44, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  btnPrimary: { paddingHorizontal: space.lg, height: 44, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dimBtn: { opacity: 0.5 },

  doneBtn: { height: 52, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 16, fontWeight: '800', color: '#fff' }
});
