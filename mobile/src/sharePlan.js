import { Alert, Platform, Share } from 'react-native';
import { countryLabels } from './countries';
import {
  categoryMeta,
  formatDay,
  formatRange,
  formatTime,
  packingMeta,
  voucherMeta
} from './theme';

export const DEFAULT_SHARE_OPTIONS = {
  vouchers: true,
  phrases: false,
  packing: false,
  mapLinks: true
};

function mapsLink(lat, lng, name) {
  if (lat == null || lng == null) return '';
  const q = encodeURIComponent(name || `${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=&center=${lat}%2C${lng}`;
}

export function buildPlanText(trip, days, vouchers, phrases, packing, options = DEFAULT_SHARE_OPTIONS) {
  const opts = { ...DEFAULT_SHARE_OPTIONS, ...options };
  const lines = [];
  lines.push(`✈️ ${trip.title}`);
  const meta = [countryLabels(trip.country), trip.destination, formatRange(trip.startDate, trip.endDate)]
    .filter(Boolean)
    .join(' · ');
  if (meta) lines.push(meta);
  lines.push('');

  const sortedDays = [...(days || [])].sort((a, b) => a.dayIndex - b.dayIndex);
  for (const day of sortedDays) {
    lines.push(`── ${day.dayIndex}일차 ${formatDay(day.date)} ──`);
    const items = [...(day.items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!items.length) {
      lines.push('  (일정 없음)');
      lines.push('');
      continue;
    }
    for (const item of items) {
      const place = item.place || {};
      const cat = categoryMeta[place.category] || categoryMeta.SIGHT;
      const time = formatTime(item.startTime);
      lines.push(`${time}  ${place.name || '장소'}`);
      lines.push(`       ${cat.label}${place.address ? ` · ${place.address}` : ''}`);
      if (place.memo) lines.push(`       💡 ${place.memo}`);
      if (item.note) lines.push(`       📝 ${item.note}`);
      if (opts.mapLinks && place.lat != null && place.lng != null) {
        lines.push(`       ${mapsLink(place.lat, place.lng, place.name)}`);
      }
    }
    lines.push('');
  }

  if (opts.vouchers && vouchers?.length) {
    lines.push('── 티켓 · 바우처 ──');
    for (const row of vouchers) {
      const label = voucherMeta[row.type]?.label || row.type;
      lines.push(`[${label}] ${row.title}`);
      if (row.body) {
        for (const line of row.body.split('\n')) lines.push(`  ${line}`);
      }
    }
    lines.push('');
  }

  if (opts.phrases && phrases?.length) {
    lines.push('── 회화 ──');
    for (const row of phrases) {
      lines.push(`• ${row.situation}`);
      lines.push(`  ${row.ko}`);
      lines.push(`  ${row.localText}`);
    }
    lines.push('');
  }

  if (opts.packing && packing?.length) {
    lines.push('── 준비물 ──');
    const byCat = {};
    for (const row of packing) {
      const key = row.category || 'OTHER';
      if (!byCat[key]) byCat[key] = [];
      byCat[key].push(row);
    }
    for (const [catId, rows] of Object.entries(byCat)) {
      const label = packingMeta[catId]?.label || catId;
      lines.push(`[${label}]`);
      for (const row of rows) {
        const mark = row.packed ? '☑' : '☐';
        lines.push(`  ${mark} ${row.name}${row.note ? ` (${row.note})` : ''}`);
      }
    }
    lines.push('');
  }

  lines.push('— Honeymoon Guide에서 공유 —');
  return lines.join('\n').trim();
}

export function buildPlanBundle(trip, days, vouchers, phrases, packing, options) {
  const text = buildPlanText(trip, days, vouchers, phrases, packing, options);
  return {
    title: trip.title,
    text,
    exportedAt: new Date().toISOString(),
    trip: {
      id: trip.id,
      title: trip.title,
      country: trip.country,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate
    },
    options: { ...DEFAULT_SHARE_OPTIONS, ...options }
  };
}

export async function sharePlanText(tripTitle, text) {
  const title = `${tripTitle} 일정`;
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text });
        return true;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        Alert.alert('복사됨', '일정 전문을 클립보드에 복사했습니다.');
        return true;
      }
      Alert.alert('공유 불가', '브라우저에서 복사할 수 없습니다. 아래 미리보기에서 직접 선택해 복사해 주세요.');
      return false;
    }
    const result = await Share.share({ title, message: text });
    return result.action !== Share.dismissedAction;
  } catch (e) {
    if (e?.message !== 'User did not share') {
      Alert.alert('공유 실패', e?.message || '다시 시도해 주세요.');
    }
    return false;
  }
}

export async function copyPlanText(text) {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      Alert.alert('복사됨', '클립보드에 복사했습니다.');
      return true;
    }
    if (Platform.OS !== 'web') {
      return sharePlanText('여행', text);
    }
    Alert.alert('복사', '아래 미리보기에서 텍스트를 선택해 복사해 주세요.');
    return false;
  } catch (e) {
    Alert.alert('복사 실패', e?.message || '텍스트를 길게 눌러 복사해 주세요.');
    return false;
  }
}
