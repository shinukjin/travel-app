import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapHubMenuBadge } from '../components/MapHubMenuBadge';
import { useLayout } from '../layout';
import { TAB_BAR_BASE, colors } from '../theme';
import MapScreen from './MapScreen';
import NearbyScreen from './NearbyScreen';

const SUB_TABS = ['map', 'nearby'];

/** 지도 허브 — 하단 탭바는 항상 보이고, 지도 영역은 탭바 위까지만 차지한다. */
export default function MapHubScreen() {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const [tab, setTab] = useState('map');

  useEffect(() => {
    const section = route.params?.section;
    if (section && SUB_TABS.includes(section)) setTab(section);
  }, [route.params?.section]);

  const panelFrame =
    layout.width > layout.contentMaxWidth
      ? { maxWidth: layout.contentMaxWidth, width: '100%', alignSelf: 'center' }
      : null;

  return (
    <View style={[styles.root, { paddingBottom: TAB_BAR_BASE + insets.bottom }]}>
      <View style={[styles.body, panelFrame]}>
        {tab === 'map' ? <MapScreen /> : null}
        {tab === 'nearby' ? <NearbyScreen embed /> : null}
      </View>
      <MapHubMenuBadge section={tab} onSectionChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.map },
  body: { flex: 1, minHeight: 0, width: '100%' }
});
