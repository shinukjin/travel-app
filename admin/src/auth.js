import { ref } from 'vue';
import { supabase } from './supabase';
import { adminApi } from './adminApi';

/** 현재 로그인 세션 (반응형) */
export const session = ref(null);
/** 현재 계정이 관리자인지 (DB 의 admins 테이블 기준) */
export const isAdmin = ref(false);
/** 관리자 확인에 실패한 이유 (함수가 없거나 권한 오류 등). 정상이면 빈 문자열 */
export const adminError = ref('');
/** 운영자가 임시 비밀번호를 줬거나 변경을 요구한 경우 — 새 비밀번호를 정할 때까지 다른 화면 이용 불가 */
export const mustChangePassword = ref(false);

let readyPromise = null;
let openLogged = false;

/** 접속 기록 — 실패해도(예: 마이그레이션 전) 화면 동작에는 영향이 없다 */
async function logAccess(event) {
  try {
    await supabase.from('access_logs').insert({
      event,
      platform: 'web-admin',
      device: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 190)
    });
  } catch {
    /* 무시 */
  }
}

async function refreshAdmin() {
  if (!session.value) {
    isAdmin.value = false;
    adminError.value = '';
    mustChangePassword.value = false;
    return;
  }
  const res = await adminApi.checkAdmin();
  isAdmin.value = res.isAdmin;
  adminError.value = res.error;
  mustChangePassword.value = res.isAdmin ? await adminApi.passwordChangeRequired() : false;
}

/** 앱 시작 시 한 번 세션을 복원한다. 라우터 가드가 이 Promise 를 기다린다. */
export function authReady() {
  if (!readyPromise) {
    readyPromise = supabase.auth.getSession().then(async ({ data }) => {
      session.value = data.session;
      if (data.session) {
        await refreshAdmin();
        if (isAdmin.value && !openLogged) {
          openLogged = true;
          logAccess('app_open');
        }
      }
      supabase.auth.onAuthStateChange((event, next) => {
        session.value = next;
        if (event === 'SIGNED_OUT') {
          isAdmin.value = false;
          adminError.value = '';
          mustChangePassword.value = false;
        }
      });
    });
  }
  return readyPromise;
}

function authError(error) {
  const msg = error.message || '';
  if (msg === 'Invalid login credentials') return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/banned/i.test(msg)) return '이용이 정지된 계정입니다.';
  if (/email not confirmed/i.test(msg)) return '이메일 확인이 필요한 계정입니다.';
  return msg;
}

/** 운영 콘솔 로그인 — 관리자 계정만 통과한다. 일반 계정이면 바로 로그아웃시키고 안내한다. */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(authError(error));
  session.value = data.session;
  await refreshAdmin();
  if (!isAdmin.value) {
    const reason = adminError.value
      ? '관리자 확인 중 오류가 났습니다: ' + adminError.value + ' (supabase/migrations 의 0002, 0003 SQL 이 적용되었는지 확인해 주세요.)'
      : '관리자 권한이 없는 계정입니다. 여행 정보는 사용자 웹을 이용해 주세요.';
    await supabase.auth.signOut();
    session.value = null;
    throw new Error(reason);
  }
  logAccess('login');
}

export async function signOut() {
  await logAccess('logout');
  isAdmin.value = false;
  await supabase.auth.signOut();
}
