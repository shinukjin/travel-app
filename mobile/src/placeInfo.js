import { storage } from './storage';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(place) {
  const id = place?.id;
  if (id != null) return String(id);
  return `${place?.name || ''}:${place?.lat}:${place?.lng}`;
}

async function searchWikiTitle(query, lang) {
  const host = lang === 'ko' ? 'https://ko.wikipedia.org' : 'https://en.wikipedia.org';
  const url = `${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.query?.search?.[0]?.title || null;
}

async function wikiSummaryByTitle(title, lang) {
  const host = lang === 'ko' ? 'https://ko.wikipedia.org' : 'https://en.wikipedia.org';
  const res = await fetch(`${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchWikiForPlace(place) {
  const name = String(place?.name || '').trim();
  if (!name) return null;

  let summary = null;
  const titleKo = await searchWikiTitle(name, 'ko');
  if (titleKo) summary = await wikiSummaryByTitle(titleKo, 'ko');
  if (!summary?.extract) {
    const titleEn = await searchWikiTitle(name, 'en');
    if (titleEn) summary = await wikiSummaryByTitle(titleEn, 'en');
  }
  if (!summary?.extract) return null;

  return {
    title: summary.title,
    extract: summary.extract,
    lang: summary.lang || (summary.title ? 'ko' : 'en'),
    thumbnail: summary.thumbnail?.source,
    pageUrl: summary.content_urls?.desktop?.page
  };
}

export async function loadPlaceEnrichment(place) {
  const key = cacheKey(place);
  const cache = await storage.getPlaceInfo();
  const hit = cache[key];
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  try {
    const wiki = await fetchWikiForPlace(place);
    const data = { wiki };
    await storage.setPlaceInfo({ ...cache, [key]: { at: Date.now(), data } });
    return data;
  } catch {
    if (hit) return hit.data;
    return { wiki: null };
  }
}

export { fetchNearbyAttractions } from './maps/googleNearby';

export function navigatePlaceInfo(navigation, place, scheduleNote) {
  if (!place) return;
  navigation.navigate('장소', { place, scheduleNote: scheduleNote || '' });
}
