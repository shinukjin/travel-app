import { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { HubShell } from '../components/HubShell';
import ScheduleScreen from './ScheduleScreen';
import PackingScreen from './PackingScreen';
import VoucherScreen from './VoucherScreen';
import SharePlanScreen from './SharePlanScreen';

const TABS = [
  { id: 'schedule', label: '일정' },
  { id: 'packing', label: '준비' },
  { id: 'voucher', label: '티켓' },
  { id: 'share', label: '공유' }
];

export default function TravelHubScreen() {
  const route = useRoute();
  const [tab, setTab] = useState('schedule');

  useEffect(() => {
    const section = route.params?.section;
    if (section && TABS.some((t) => t.id === section)) setTab(section);
  }, [route.params?.section]);

  return (
    <HubShell title="여행" tabs={TABS} value={tab} onChange={setTab}>
      {tab === 'schedule' ? <ScheduleScreen embed /> : null}
      {tab === 'packing' ? <PackingScreen embed /> : null}
      {tab === 'voucher' ? <VoucherScreen embed /> : null}
      {tab === 'share' ? <SharePlanScreen embed /> : null}
    </HubShell>
  );
}
