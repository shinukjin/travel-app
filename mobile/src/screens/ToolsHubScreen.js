import { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { HubShell } from '../components/HubShell';
import ExchangeScreen from './ExchangeScreen';
import PhraseScreen from './PhraseScreen';
import SettingsScreen from './SettingsScreen';

const TABS = [
  { id: 'exchange', label: '환율' },
  { id: 'phrase', label: '회화' },
  { id: 'settings', label: '설정' }
];

export default function ToolsHubScreen() {
  const route = useRoute();
  const [tab, setTab] = useState('exchange');

  useEffect(() => {
    const section = route.params?.section;
    if (route.params?.editTripId) setTab('settings');
    else if (section && TABS.some((t) => t.id === section)) setTab(section);
  }, [route.params?.section, route.params?.editTripId]);

  return (
    <HubShell title="도구" tabs={TABS} value={tab} onChange={setTab}>
      {tab === 'exchange' ? <ExchangeScreen embed /> : null}
      {tab === 'phrase' ? <PhraseScreen embed /> : null}
      {tab === 'settings' ? <SettingsScreen embed /> : null}
    </HubShell>
  );
}
