import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryLabels } from './countries';
import { travelLeg } from './route';
import { useLayout } from './layout';
import { colors, contentPad, formatRange, formatWeek, radius, shadow, space, type } from './theme';

export function Icon({ name, size = 20, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function TravelLeg({ from, to }) {
  const leg = travelLeg(from, to);
  if (!leg) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(leg.url)}
      style={styles.leg}
      accessibilityRole="button"
      accessibilityLabel={`${leg.label} 길찾기`}
    >
      <Icon name={leg.walk ? 'walk' : 'car'} size={14} color={colors.muted} />
      <Text style={styles.legLabel}>{leg.label}</Text>
      <Text style={styles.legLink}>길찾기</Text>
    </Pressable>
  );
}

export function shortTitle(title) {
  return String(title || '').replace(/\s*신혼여행\s*$/, '') || title;
}

export function Screen({ children, scroll = false, contentStyle, style, inHub = false, fullBleed = false, ...rest }) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const gutter = fullBleed ? space.lg : layout.gutter;
  const pad = contentPad(insets.bottom, inHub ? 0 : insets.top, gutter);
  const frame =
    fullBleed || layout.width <= layout.contentMaxWidth
      ? null
      : { maxWidth: layout.contentMaxWidth, width: '100%', alignSelf: 'center' };
  const layoutStyle = inHub ? [styles.screen, styles.screenInHub, style] : [styles.screen, style];
  if (scroll) {
    return (
      <ScrollView
        style={layoutStyle}
        contentContainerStyle={[pad, frame, styles.gap, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={[layoutStyle, pad, frame, styles.gap, contentStyle]}>
      {children}
    </View>
  );
}

export function Empty({ message = '없음' }) {
  return (
    <View style={styles.empty}>
      <Text style={type.meta}>{message}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, icon }) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, primary ? styles.btnPrimary : styles.btnGhost, disabled && styles.btnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Icon name={icon} size={18} color={primary ? 'white' : colors.ink} /> : null}
      {label ? <Text style={[styles.btnText, primary ? styles.btnTextOn : styles.btnTextGhost]}>{label}</Text> : null}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, multiline, placeholder, ...rest }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
      />
    </View>
  );
}

export function TextTabs({ value, options, onChange }) {
  return (
    <View style={styles.textTabs}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.textTab, on && styles.textTabOn]}
            hitSlop={6}
          >
            <Text style={[styles.textTabLabel, on && styles.textTabLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 아이콘 + 라벨 세그먼트 (지도 허브 등) — option: { id, label, icon: [outline, filled] } */
export function MenuIconTabs({ value, options, onChange }) {
  return (
    <View style={styles.textTabs}>
      {options.map((option) => {
        const on = option.id === value;
        const [outline, filled] = option.icon || ['ellipse-outline', 'ellipse'];
        const iconName = on ? filled : outline;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.menuIconTab, on && styles.textTabOn]}
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
          >
            <Icon name={iconName} size={18} color={on ? colors.ink : colors.muted} />
            <Text style={[styles.textTabLabel, on && styles.textTabLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Surface({ children, style, inset = true }) {
  return <View style={[styles.surface, inset && styles.surfaceInset, style]}>{children}</View>;
}

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function ScreenHeader({ eyebrow, title, meta, right, children }) {
  return (
    <View style={styles.pageHead}>
      <View style={styles.pageHeadRow}>
        <View style={styles.pageHeadBody}>
          {eyebrow ? <Text style={styles.pageEyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.pageTitle} numberOfLines={2}>{title}</Text> : null}
          {meta ? <Text style={styles.pageMeta} numberOfLines={2}>{meta}</Text> : null}
        </View>
        {right ? <View style={styles.pageHeadRight}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

export function TripPageHead({ trip, trips, tripId, onSelectTrip, onEdit, offline }) {
  if (!trip) {
    return <ScreenHeader title="일정" meta="여행을 추가해 주세요" />;
  }
  const eyebrow = [countryLabels(trip.country), offline ? '오프라인' : null].filter(Boolean).join(' · ');
  const meta = [trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ');
  return (
    <ScreenHeader
      eyebrow={eyebrow}
      title={trip.title}
      meta={meta}
      right={
        onEdit ? (
          <Pressable onPress={() => onEdit(trip)} style={styles.headIconBtn} accessibilityRole="button" accessibilityLabel="편집">
            <Icon name="create-outline" size={18} color={colors.ink} />
          </Pressable>
        ) : null
      }
    >
      <TripPicker trips={trips} tripId={tripId} onSelect={onSelectTrip} />
    </ScreenHeader>
  );
}

/** @deprecated use TripPageHead */
export function ScheduleHeader({ trip, onEdit }) {
  return <TripPageHead trip={trip} onEdit={onEdit} />;
}

export function TripPicker({ trips, tripId, onSelect }) {
  if (!trips?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hGrow0} contentContainerStyle={styles.tripRow}>
      {trips.map((item) => {
        const on = item.id === tripId;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.tripChip, on && styles.tripChipOn]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tripChipText, on && styles.tripChipTextOn]} numberOfLines={1}>
              {shortTitle(item.title)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function DayStrip({ days, selectedId, onSelect }) {
  if (!days?.length) return null;
  return (
    <View style={styles.dayStripWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hGrow0}
        contentContainerStyle={styles.dayRow}
      >
        {days.map((day) => {
          const on = day.id === selectedId;
          return (
            <Pressable
              key={day.id}
              onPress={() => onSelect(day.id)}
              style={[styles.dayPill, on && styles.dayPillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.dayNum, on && styles.dayNumOn]}>{day.dayIndex}</Text>
              <Text style={[styles.dayWeek, on && styles.dayWeekOn]}>{formatWeek(day.date)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function IconCats({ options, value, onChange }) {
  return (
    <View style={styles.iconCats}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.iconCat, on && styles.iconCatOn]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
          >
            <Icon name={option.icon} size={15} color={on ? 'white' : colors.ink} />
            {option.label ? (
              <Text style={[styles.iconCatLabel, on && styles.iconCatLabelOn]} numberOfLines={1}>
                {option.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** @deprecated use TextTabs */
export function Segmented(props) {
  return <TextTabs {...props} />;
}

/** @deprecated use ScheduleHeader */
export function TripHero({ trip, onEdit }) {
  return <ScheduleHeader trip={trip} onEdit={onEdit} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  screenInHub: { minHeight: 0 },
  gap: { gap: space.lg },
  hGrow0: { flexGrow: 0 },
  surface: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line
  },
  surfaceInset: { padding: space.lg },
  sectionLabel: {
    ...type.section,
    marginBottom: -space.xs
  },
  empty: { alignItems: 'center', paddingVertical: space.xl },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    minHeight: 48
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: colors.surfaceMuted },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '700', fontSize: 15 },
  btnTextOn: { color: 'white' },
  btnTextGhost: { color: colors.ink },
  field: { gap: space.sm },
  fieldLabel: { ...type.caption, textTransform: 'none', color: colors.muted },
  fieldInput: {
    fontSize: 16,
    color: colors.ink,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  fieldArea: { minHeight: 120, textAlignVertical: 'top' },
  textTabs: {
    flexDirection: 'row',
    gap: space.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4
  },
  textTab: { flex: 1, paddingVertical: space.sm, borderRadius: radius.pill, alignItems: 'center' },
  menuIconTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill
  },
  textTabOn: { backgroundColor: colors.card, ...shadow.card },
  textTabLabel: { fontSize: 14, fontWeight: '600', color: colors.muted },
  textTabLabelOn: { color: colors.ink, fontWeight: '800' },
  pageHead: { gap: space.md, marginBottom: space.xs },
  pageHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  pageHeadBody: { flex: 1, gap: 6 },
  pageHeadRight: { paddingTop: 2 },
  pageEyebrow: { ...type.caption, color: colors.accent },
  pageTitle: { ...type.title, fontSize: 27, lineHeight: 35 },
  pageMeta: { ...type.meta },
  headIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card
  },
  tripRow: { gap: space.sm, paddingRight: space.lg, marginTop: space.xs },
  tripChip: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    maxWidth: 150
  },
  tripChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  tripChipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  tripChipTextOn: { color: 'white' },
  dayStripWrap: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.card,
    padding: 4,
    marginHorizontal: -2
  },
  dayRow: { gap: 4, paddingVertical: 0 },
  dayPill: {
    alignItems: 'center',
    minWidth: 48,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: radius.control
  },
  dayPillOn: { backgroundColor: colors.card, borderBottomWidth: 3, borderBottomColor: colors.tram },
  dayNum: { fontSize: 15, fontWeight: '700', color: colors.muted },
  dayNumOn: { color: colors.navy, fontSize: 17 },
  dayWeek: { fontSize: 10, color: colors.faint, marginTop: 2, fontWeight: '700' },
  dayWeekOn: { color: colors.ink },
  iconCats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  iconCat: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.lineHair
  },
  iconCatOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  iconCatLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  iconCatLabelOn: { color: 'white' },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginLeft: space.lg,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  legLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  legLink: { fontSize: 12, fontWeight: '800', color: colors.accent }
});
