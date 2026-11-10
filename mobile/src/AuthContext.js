import { Platform } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

let openLogged = false;

/** 접속 기록 (가입·로그인·앱 실행·로그아웃). 실패해도 앱 동작에는 영향이 없다. */
async function logAccess(event) {
  try {
    await supabase.from('access_logs').insert({
      event,
      platform: Platform.OS,
      device: `${Platform.OS} ${Platform.Version}`.slice(0, 190)
    });
  } catch {
    /* 무시 */
  }
}

function friendlyAuthError(error) {
  const msg = error.message || '';
  if (msg === 'Invalid login credentials') return '이메일 또는 비밀번호가 올바르지 않아요.';
  if (/banned/i.test(msg)) return '이용이 정지된 계정이에요. 관리자에게 문의해 주세요.';
  if (/email not confirmed/i.test(msg)) return '이메일 확인이 필요해요. 가입 확인 메일의 링크를 눌러 주세요.';
  return msg;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // 운영자가 임시 비밀번호를 줬거나 변경을 요구한 상태
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const refreshPasswordFlag = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('my_password_reset_required');
      setMustChangePassword(data === true);
    } catch {
      setMustChangePassword(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) refreshPasswordFlag();
      setLoading(false);
      if (data.session && !openLogged) {
        openLogged = true;
        logAccess('app_open');
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setMustChangePassword(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(friendlyAuthError(error));
    openLogged = true;
    logAccess('login');
    await refreshPasswordFlag();
  }, [refreshPasswordFlag]);

  /** 회원가입. 이메일 확인이 켜져 있으면 { needsConfirm: true } — 메일의 링크를 눌러야 로그인할 수 있다. */
  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      const msg = error.message || '';
      if (/already registered/i.test(msg)) throw new Error('이미 가입된 이메일이에요. 로그인해 주세요.');
      if (/signups? (not allowed|are disabled)|not allowed for this instance/i.test(msg)) {
        throw new Error('현재 가입이 막혀 있어요. Supabase에서 새 사용자 가입을 허용해 주세요.');
      }
      if (/at least \d+ characters/i.test(msg)) throw new Error('비밀번호가 너무 짧아요. 더 길게 입력해 주세요.');
      throw new Error(msg);
    }
    // 이미 가입된 이메일인데 확인 메일 설정이면 identities 가 비어 있다 (계정 존재 여부 노출 방지 동작)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('이미 가입된 이메일이에요. 로그인해 주세요.');
    }
    if (data.session) {
      openLogged = true;
      logAccess('signup');
    }
    return { needsConfirm: !data.session };
  }, []);

  /** 비밀번호 변경 — 성공하면 "변경 필요" 표시도 함께 해제된다 */
  const changePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(/same|different from the old/i.test(error.message) ? '이전과 다른 비밀번호를 입력해 주세요.' : error.message);
    }
    await supabase.rpc('clear_password_change_required');
    setMustChangePassword(false);
  }, []);

  const signOut = useCallback(async () => {
    await logAccess('logout');
    openLogged = false;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading, mustChangePassword, changePassword, signIn, signUp, signOut }),
    [session, loading, mustChangePassword, changePassword, signIn, signUp, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
