import { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { HubShell } from '../components/HubShell';
import MemoScreen from './MemoScreen';
import MemoriesScreen from './MemoriesScreen';

const TABS = [
  { id: 'memo', label: '메모' },
  { id: 'memories', label: '사진' }
];

export default function RecordHubScreen() {
  const route = useRoute();
  const [tab, setTab] = useState('memo');

  useEffect(() => {
    const section = route.params?.section;
    if (section && TABS.some((t) => t.id === section)) setTab(section);
  }, [route.params?.section]);

  return (
    <HubShell title="기록" tabs={TABS} value={tab} onChange={setTab}>
      {tab === 'memo' ? <MemoScreen embed /> : null}
      {tab === 'memories' ? <MemoriesScreen embed /> : null}
    </HubShell>
  );
}
