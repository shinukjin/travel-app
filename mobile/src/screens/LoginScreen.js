import { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { supabaseConfigured } from '../supabase';
import { colors, radius, space } from '../theme';
import { HeroArt } from '../components/HeroArt';
import { Icon } from '../ui';

const LOGO = require('../../assets/logo.png');
const MIN_PASSWORD = 8;

/** 이메일 로그인 / 회원가입 — 계정별로 데이터가 분리된다 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const signup = mode === 'signup';
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = signup ? password.length >= MIN_PASSWORD : password.length > 0;
  const confirmOk = !signup || (confirm.length > 0 && confirm === password);
  const canSubmit = supabaseConfigured && emailOk && passwordOk && confirmOk && !busy;

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
    setConfirm('');
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (signup) {
        const { needsConfirm } = await signUp(email, password);
        if (needsConfirm) {
          // 이메일 확인이 켜져 있으면 메일의 링크를 누른 뒤 로그인해야 한다
          setNotice('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.');
          setMode('login');
          setConfirm('');
        }
        // 확인이 꺼져 있으면 가입과 동시에 로그인되어 이 화면은 사라진다
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setError(e.message || (signup ? '가입에 실패했어요.' : '로그인에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, space.xl) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          <HeroArt style={[styles.hero, { paddingTop: Math.max(insets.top, space.xl) + space.lg }]} shade={0.5}>
            <Image source={LOGO} style={styles.logo} />
            <Text style={styles.title}>Honeymoon Guide</Text>
            <Text style={styles.sub}>{signup ? '계정을 만들면 어디서든 우리 여행을 볼 수 있어요' : '로그인하면 어디서든 우리 여행을 볼 수 있어요'}</Text>
          </HeroArt>
        </View>

        <View style={styles.content}>
        <View style={styles.modes}>
          {[
            { id: 'login', label: '로그인' },
            { id: 'signup', label: '회원가입' }
          ].map((m) => {
            const on = m.id === mode;
            return (
              <Pressable key={m.id} onPress={() => switchMode(m.id)} style={[styles.mode, on && styles.modeOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!supabaseConfigured ? (
          <View style={styles.warn}>
            <Icon name="warning-outline" size={18} color="#8A5A00" />
            <Text style={styles.warnText}>Supabase 설정이 없어요. 루트 .env 에 SUPABASE_URL, SUPABASE_ANON_KEY 를 넣고 앱을 다시 시작해 주세요.</Text>
          </View>
        ) : null}

        {notice ? (
          <View style={styles.notice}>
            <Icon name="mail-outline" size={18} color={colors.forest} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>비밀번호{signup ? ` (${MIN_PASSWORD}자 이상)` : ''}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                placeholderTextColor={colors.faint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType={signup ? 'newPassword' : 'password'}
                autoComplete={signup ? 'new-password' : 'password'}
                returnKeyType={signup ? 'next' : 'go'}
                onSubmitEditing={() => (signup ? confirmRef.current?.focus() : submit())}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>
                <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
              </Pressable>
            </View>
            {signup && password.length > 0 && password.length < MIN_PASSWORD ? (
              <Text style={styles.hint}>{MIN_PASSWORD - password.length}자 더 입력해 주세요</Text>
            ) : null}
          </View>

          {signup ? (
            <View style={styles.field}>
              <Text style={styles.label}>비밀번호 확인</Text>
              <TextInput
                ref={confirmRef}
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="비밀번호를 한 번 더"
                placeholderTextColor={colors.faint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              {confirm.length > 0 && confirm !== password ? <Text style={styles.hintError}>비밀번호가 서로 달라요</Text> : null}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={submit} disabled={!canSubmit} style={[styles.submit, !canSubmit && styles.submitOff]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{signup ? '가입하기' : '로그인'}</Text>}
          </Pressable>
        </View>

        <Text style={styles.foot}>
          {signup ? '계정마다 여행 데이터가 따로 저장돼요. 부부가 함께 보려면 한 계정을 같이 쓰세요.' : '처음이라면 위의 회원가입 탭에서 계정을 만들어 주세요.'}
        </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  heroWrap: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', backgroundColor: colors.navy },
  hero: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.xxl + space.md },
  logo: { width: 96, height: 96 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.xl },
  modes: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  mode: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.navy },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  modeTextOn: { color: '#fff' },
  warn: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.tramSoft },
  warnText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#7A4F00' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.forestSoft },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.forest, fontWeight: '600' },
  form: { gap: space.lg },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  input: { height: 52, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 16, color: colors.ink },
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: space.md },
  hint: { fontSize: 12, color: colors.muted },
  hintError: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger },
  submit: { height: 54, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  submitOff: { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  foot: { fontSize: 12, color: colors.faint, textAlign: 'center', lineHeight: 18 }
});
