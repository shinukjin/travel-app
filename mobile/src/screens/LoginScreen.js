import { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { supabaseConfigured } from '../supabase';
import { APP_VERSION_LABEL } from '../appVersion';
import { colors, radius, shadow, space } from '../theme';
import { HeroArt } from '../components/HeroArt';
import { Icon } from '../ui';

const LOGO = require('../../assets/logo.png');
const MIN_PASSWORD = 8;
/** 히어로 아래로 카드가 겹치는 높이 */
const OVERLAP = 40;

/** 아이콘이 붙은 입력칸 — 포커스되면 테두리가 강조된다 */
function Field({ label, icon, focused, right, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputBoxFocus]}>
        <Icon name={icon} size={19} color={focused ? colors.accent : colors.faint} />
        {children}
        {right}
      </View>
    </View>
  );
}

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
  const [focus, setFocus] = useState('');
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
      {/* 남색 히어로 위에서도 시간·배터리가 보이도록 밝은 아이콘 */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, space.xl) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <HeroArt style={[styles.hero, { paddingTop: Math.max(insets.top, space.lg) + space.xl }]} shade={0.5}>
            <View style={styles.logoRing}>
              <Image source={LOGO} style={styles.logo} />
            </View>
            <Text style={styles.title}>Honeymoon Guide</Text>
            <Text style={styles.sub}>{signup ? '계정을 만들면 어디서든\n우리 여행을 볼 수 있어요' : '로그인하면 어디서든\n우리 여행을 볼 수 있어요'}</Text>
          </HeroArt>
        </View>

        <View style={styles.card}>
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
            <Field label="이메일" icon="mail-outline" focused={focus === 'email'}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus('')}
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
            </Field>

            <View>
              <Field
                label={`비밀번호${signup ? ` (${MIN_PASSWORD}자 이상)` : ''}`}
                icon="lock-closed-outline"
                focused={focus === 'password'}
                right={
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>
                    <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                  </Pressable>
                }
              >
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocus('')}
                  placeholder="비밀번호"
                  placeholderTextColor={colors.faint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType={signup ? 'newPassword' : 'password'}
                  autoComplete={signup ? 'new-password' : 'password'}
                  returnKeyType={signup ? 'next' : 'go'}
                  onSubmitEditing={() => (signup ? confirmRef.current?.focus() : submit())}
                />
              </Field>
              {signup && password.length > 0 && password.length < MIN_PASSWORD ? (
                <Text style={styles.hint}>{MIN_PASSWORD - password.length}자 더 입력해 주세요</Text>
              ) : null}
            </View>

            {signup ? (
              <View>
                <Field label="비밀번호 확인" icon="shield-checkmark-outline" focused={focus === 'confirm'}>
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    value={confirm}
                    onChangeText={setConfirm}
                    onFocus={() => setFocus('confirm')}
                    onBlur={() => setFocus('')}
                    placeholder="비밀번호를 한 번 더"
                    placeholderTextColor={colors.faint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                  />
                </Field>
                {confirm.length > 0 && confirm !== password ? <Text style={styles.hintError}>비밀번호가 서로 달라요</Text> : null}
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable onPress={submit} disabled={!canSubmit} style={({ pressed }) => [styles.submit, !canSubmit && styles.submitOff, pressed && styles.pressed]} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{signup ? '가입하기' : '로그인'}</Text>}
            </Pressable>
          </View>
        </View>

        <Text style={styles.foot}>
          {signup ? '계정마다 여행 데이터가 따로 저장돼요.\n부부가 함께 보려면 한 계정을 같이 쓰세요.' : '처음이라면 위의 회원가입 탭에서\n계정을 만들어 주세요.'}
        </Text>
        <Text style={styles.version}>{APP_VERSION_LABEL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  heroWrap: { borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', backgroundColor: colors.navy },
  hero: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingBottom: OVERLAP + space.xxl },
  logoRing: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: space.sm },
  logo: { width: 84, height: 84 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  sub: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  card: { marginTop: -OVERLAP, marginHorizontal: space.lg, padding: space.xl, gap: space.xl, borderRadius: radius.sheet + 4, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.float },
  modes: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  mode: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.card },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  modeTextOn: { color: colors.accentDark },
  warn: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.tramSoft },
  warnText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#7A4F00' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.forestSoft },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.forest, fontWeight: '600' },

  form: { gap: space.lg },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 54, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.surfaceTint, borderWidth: 1.5, borderColor: 'transparent' },
  inputBoxFocus: { backgroundColor: colors.card, borderColor: colors.accent },
  input: { flex: 1, height: '100%', fontSize: 16, color: colors.ink, paddingVertical: 0 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  hintError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginTop: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: '#FBE9E7' },
  error: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.danger, lineHeight: 18 },
  submit: { height: 56, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  submitOff: { opacity: 0.45 },
  pressed: { opacity: 0.9 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  foot: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18, marginTop: space.xl, paddingHorizontal: space.xl },
  version: { fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: space.md }
});
