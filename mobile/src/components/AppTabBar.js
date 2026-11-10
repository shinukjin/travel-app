import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { Ionicons } from '@expo/vector-icons';
import { useLayout } from '../layout';
import { MAIN_TAB_ICONS } from '../tabNav';
import { colors, tabBarStyleForInset } from '../theme';

const TAB_MIN_WIDTH = 64;

function TabButton({ route, index, focused, descriptors, navigation, distribute }) {
  const { options } = descriptors[route.key];
  const label = options.tabBarLabel ?? options.title ?? route.name;
  const pair = MAIN_TAB_ICONS[route.name] || ['ellipse-outline', 'ellipse'];
  const color = focused ? colors.accent : colors.faint;

  const onPress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, distribute && styles.tabDistribute, !distribute && { minWidth: TAB_MIN_WIDTH }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={typeof label === 'string' ? label : route.name}
    >
      <View style={[styles.iconPill, focused && styles.iconPillOn]}>
        <Ionicons name={focused ? pair[1] : pair[0]} size={22} color={color} />
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {typeof label === 'string' ? label : route.name}
      </Text>
    </Pressable>
  );
}

export function AppTabBar({ state, descriptors, navigation, insets }) {
  const layout = useLayout();
  const barStyle = tabBarStyleForInset(insets.bottom, layout.tabSideInset);
  const distribute = layout.distributeTabs;

  const tabs = state.routes.map((route, index) => (
    <TabButton
      key={route.key}
      route={route}
      index={index}
      focused={state.index === index}
      descriptors={descriptors}
      navigation={navigation}
      distribute={distribute}
    />
  ));

  return (
    <View style={[styles.wrap, barStyle]}>
      {distribute ? (
        <View style={styles.row}>{tabs}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {tabs}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 0,
    elevation: 0
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly'
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: 4
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 3
  },
  iconPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconPillOn: { backgroundColor: colors.accentSoft },
  tabDistribute: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700' }
});
