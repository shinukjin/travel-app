import { ref } from 'vue';
import { supabase } from './supabase';

/** 현재 로그인 세션 (반응형) */
export const session = ref(null);
/** 운영자가 임시 비밀번호를 줬거나 변경을 요구한 상태 — 새 비밀번호를 정할 때까지 다른 화면 이용 불가 */
export const mustChangePassword = ref(false);

let readyPromise = null;
let openLogged = false;

/** 접속 기록 — 실패해도(예: 마이그레이션 전) 화면 동작에는 영향이 없다 */
async function logAccess(event) {
  try {
    await supabase.from('access_logs').insert({
      event,
      platform: 'web',
      device: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 190)
    });
  } catch {
    /* 무시 */
  }
}

async function refreshPasswordFlag() {
  if (!session.value) {
    mustChangePassword.value = false;
    return;
  }
  const { data, error } = await supabase.rpc('my_password_reset_required');
  mustChangePassword.value = !error && data === true;
}

/** 앱 시작 시 한 번 세션을 복원한다. 라우터 가드가 이 Promise 를 기다린다. */
export function authReady() {
  if (!readyPromise) {
    readyPromise = supabase.auth.getSession().then(async ({ data }) => {
      session.value = data.session;
      await refreshPasswordFlag();
      if (data.session && !openLogged) {
        openLogged = true;
        logAccess('app_open');
      }
      supabase.auth.onAuthStateChange((_event, next) => {
        session.value = next;
        if (!next) mustChangePassword.value = false;
      });
    });
  }
  return readyPromise;
}

function authError(error) {
  const msg = error.message || '';
  if (msg === 'Invalid login credentials') return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/banned/i.test(msg)) return '이용이 정지된 계정입니다. 관리자에게 문의해 주세요.';
  if (/email not confirmed/i.test(msg)) return '이메일 확인이 필요합니다. 가입 확인 메일의 링크를 눌러 주세요.';
  return msg;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(authError(error));
  session.value = data.session;
  await refreshPasswordFlag();
  logAccess('login');
}

/** 회원가입. 이메일 확인이 켜져 있으면 { needsConfirm: true } */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) {
    const msg = error.message || '';
    if (/already registered/i.test(msg)) throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.');
    if (/signups? (not allowed|are disabled)|not allowed for this instance/i.test(msg)) {
      throw new Error('현재 가입이 막혀 있습니다. Supabase에서 새 사용자 가입을 허용해 주세요.');
    }
    if (/at least \d+ characters/i.test(msg)) throw new Error('비밀번호가 너무 짧습니다. 더 길게 입력해 주세요.');
    throw new Error(msg);
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.');
  }
  if (data.session) {
    session.value = data.session;
    logAccess('signup');
  }
  return { needsConfirm: !data.session };
}

export async function signOut() {
  await logAccess('logout');
  await supabase.auth.signOut();
}

/** 내 비밀번호 변경 — 성공하면 "변경 필요" 표시도 함께 해제된다 */
export async function changePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/same.*password|different from the old/i.test(error.message)) throw new Error('이전과 다른 비밀번호를 입력해 주세요.');
    throw new Error(error.message);
  }
  await supabase.rpc('clear_password_change_required');
  mustChangePassword.value = false;
}
