const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  const env = {};
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* 없음 */
  }
  return env;
}

const rootEnv = loadEnvFile(path.join(__dirname, '..', '.env'));
const localEnv = loadEnvFile(path.join(__dirname, '.env'));

/** 루트 .env / mobile/.env / 프로세스 환경 변수에서 값을 찾는다 (대소문자 둘 다 허용) */
function pick(...names) {
  for (const name of names) {
    const value = process.env[name] || rootEnv[name] || localEnv[name];
    if (value) return value;
  }
  return '';
}

const googleMapsApiKey = pick('google_maps_api_key', 'GOOGLE_MAPS_API_KEY');
// Supabase: anon 키는 공개용 키다 (보호는 DB의 RLS). service_role 키는 절대 넣지 말 것.
const supabaseUrl = pick('supabase_url', 'SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
// 대시보드의 "anon public" 또는 "Publishable key"(sb_publishable_...) 를 어떤 이름으로 넣어도 찾는다.
const supabaseAnonKey = pick(
  'supabase_anon_key',
  'SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
);

// 관리자 키(service_role / secret)가 앱 번들에 실수로 들어가는 것을 막는다.
function assertNotSecretKey(key) {
  if (!key) return;
  let role = '';
  try {
    role = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64').toString('utf8')).role || '';
  } catch {
    /* JWT 가 아닌 새 형식 키 */
  }
  if (key.startsWith('sb_secret_') || role === 'service_role') {
    throw new Error(
      '[Supabase] 관리자(service_role/secret) 키가 설정되어 있습니다. 앱에는 anon/publishable 키만 넣어야 합니다. 키를 교체해 주세요.'
    );
  }
}
assertNotSecretKey(supabaseAnonKey);

// app.json 의 값(아이콘·스플래시·플러그인·권한)을 기반으로 두고, 비밀 값만 덧씌운다.
module.exports = ({ config }) => ({
  ...config,
  orientation: 'default',
  userInterfaceStyle: 'light',
  extra: {
    ...config.extra,
    googleMapsApiKey,
    supabaseUrl,
    supabaseAnonKey
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: googleMapsApiKey }
    }
  },
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      googleMapsApiKey
    }
  }
});
