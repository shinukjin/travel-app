export const PINNED = ['KR', 'JP', 'TH', 'VN', 'TW', 'CN', 'SG', 'US', 'FR', 'IT', 'ES', 'PT', 'GB', 'DE', 'CH', 'AU'];

const ROWS = [
  ['AF', '아프가니스탄'], ['AL', '알바니아'], ['DZ', '알제리'], ['AD', '안도라'], ['AO', '앙골라'],
  ['AR', '아르헨티나'], ['AM', '아르메니아'], ['AU', '호주'], ['AT', '오스트리아'], ['AZ', '아제르바이잔'],
  ['BH', '바레인'], ['BD', '방글라데시'], ['BY', '벨라루스'], ['BE', '벨기에'], ['BZ', '벨리즈'],
  ['BJ', '베냉'], ['BT', '부탄'], ['BO', '볼리비아'], ['BA', '보스니아 헤르체고비나'], ['BW', '보츠와나'],
  ['BR', '브라질'], ['BN', '브루나이'], ['BG', '불가리아'], ['KH', '캄보디아'], ['CM', '카메룬'],
  ['CA', '캐나다'], ['CV', '카보베르데'], ['CL', '칠레'], ['CN', '중국'], ['CO', '콜롬비아'],
  ['CR', '코스타리카'], ['HR', '크로아티아'], ['CU', '쿠바'], ['CY', '키프로스'], ['CZ', '체코'],
  ['DK', '덴마크'], ['DO', '도미니카 공화국'], ['EC', '에콰도르'], ['EG', '이집트'], ['SV', '엘살바도르'],
  ['EE', '에스토니아'], ['ET', '에티오피아'], ['FJ', '피지'], ['FI', '핀란드'], ['FR', '프랑스'],
  ['GE', '조지아'], ['DE', '독일'], ['GH', '가나'], ['GR', '그리스'], ['GT', '과테말라'],
  ['HN', '온두라스'], ['HK', '홍콩'], ['HU', '헝가리'], ['IS', '아이슬란드'], ['IN', '인도'],
  ['ID', '인도네시아'], ['IR', '이란'], ['IQ', '이라크'], ['IE', '아일랜드'], ['IL', '이스라엘'],
  ['IT', '이탈리아'], ['JM', '자메이카'], ['JP', '일본'], ['JO', '요르단'], ['KZ', '카자흐스탄'],
  ['KE', '케냐'], ['KW', '쿠웨이트'], ['KG', '키르기스스탄'], ['LA', '라오스'], ['LV', '라트비아'],
  ['LB', '레바논'], ['LY', '리비아'], ['LI', '리히텐슈타인'], ['LT', '리투아니아'], ['LU', '룩셈부르크'],
  ['MO', '마카오'], ['MG', '마다가스카르'], ['MY', '말레이시아'], ['MV', '몰디브'], ['MT', '몰타'],
  ['MU', '모리셔스'], ['MX', '멕시코'], ['MD', '몰도바'], ['MC', '모나코'], ['MN', '몽골'],
  ['ME', '몬테네그로'], ['MA', '모로코'], ['MM', '미얀마'], ['NP', '네팔'], ['NL', '네덜란드'],
  ['NZ', '뉴질랜드'], ['NI', '니카라과'], ['NG', '나이지리아'], ['MK', '북마케도니아'], ['NO', '노르웨이'],
  ['OM', '오만'], ['PK', '파키스탄'], ['PA', '파나마'], ['PY', '파라과이'], ['PE', '페루'],
  ['PH', '필리핀'], ['PL', '폴란드'], ['PT', '포르투갈'], ['PR', '푸에르토리코'], ['QA', '카타르'],
  ['RO', '루마니아'], ['RU', '러시아'], ['RW', '르완다'], ['SA', '사우디아라비아'], ['SN', '세네갈'],
  ['RS', '세르비아'], ['SC', '세이셸'], ['SG', '싱가포르'], ['SK', '슬로바키아'], ['SI', '슬로베니아'],
  ['ZA', '남아프리카 공화국'], ['KR', '대한민국'], ['ES', '스페인'], ['LK', '스리랑카'], ['SE', '스웨덴'],
  ['CH', '스위스'], ['TW', '대만'], ['TZ', '탄자니아'], ['TH', '태국'], ['TL', '동티모르'],
  ['TN', '튀니지'], ['TR', '튀르키예'], ['UG', '우간다'], ['UA', '우크라이나'], ['AE', '아랍에미리트'],
  ['GB', '영국'], ['US', '미국'], ['UY', '우루과이'], ['UZ', '우즈베키스탄'], ['VU', '바누아투'],
  ['VA', '바티칸'], ['VE', '베네수엘라'], ['VN', '베트남'], ['YE', '예멘'], ['ZM', '잠비아'],
  ['ZW', '짐바브웨']
];

export const COUNTRIES = ROWS
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const byCode = Object.fromEntries(COUNTRIES.map((item) => [item.code, item]));

export function parseCountries(value) {
  return String(value || '')
    .split(/[,/|;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .filter((code, index, list) => list.indexOf(code) === index);
}

export function formatCountries(value) {
  return parseCountries(Array.isArray(value) ? value.join(',') : value).join(',');
}

export function firstCountry(value) {
  return parseCountries(value)[0] || '';
}

export function countryFlag(code) {
  const cc = firstCountry(code) || String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🌍';
  return String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function countryLabel(code) {
  const codes = parseCountries(code);
  if (codes.length > 1) return countryLabels(code);
  const single = codes[0] || String(code || '').toUpperCase();
  return byCode[single]?.name || code || '-';
}

export function countryLabels(value) {
  const codes = parseCountries(value);
  return codes.length ? codes.map((code) => byCode[code]?.name || code).join(' · ') : '-';
}

export function searchCountries(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    const pinned = PINNED.map((code) => byCode[code]).filter(Boolean);
    const rest = COUNTRIES.filter((item) => !PINNED.includes(item.code));
    return [...pinned, ...rest];
  }
  return COUNTRIES.filter((item) =>
    item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
  );
}

const COVERS = [
  ['#7A1F2B', '#C45C3A'],
  ['#1F3D34', '#4A7C6A'],
  ['#1E3A5F', '#3D6B9A'],
  ['#4C1D95', '#7C3AED'],
  ['#7C2D12', '#C2410C'],
  ['#134E4A', '#0F766E'],
  ['#1F2937', '#4B5563'],
  ['#9A3412', '#EA580C']
];

export function countryCover(code) {
  const cc = firstCountry(code) || 'KR';
  let hash = 0;
  for (let i = 0; i < cc.length; i += 1) hash += cc.charCodeAt(i) * (i + 7);
  return COVERS[hash % COVERS.length];
}
