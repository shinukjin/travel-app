import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** 환경 변수가 없으면 로그인 화면에서 설정 안내를 보여 준다 */
export const supabaseConfigured = Boolean(url && anonKey);

// anon 키는 공개되어도 되는 키다. 실제 보호는 DB의 RLS(본인 행만 접근)가 한다.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
