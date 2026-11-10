import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { checkPassword } from '../password';
import { colors, radius, space } from '../theme';
import { Icon } from '../ui';

/**
 * 비밀번호 변경 화면.
 * forced=true: 운영자가 임시 비밀번호를 준 경우 — 새 비밀번호를 정해야만 앱을 쓸 수 있다 (닫기 없음, 로그아웃만 가능).
 * forced=false: 설정에서 직접 바꾸는 경우 (onClose 로 닫는다).
 */
export default function ChangePasswordScreen({ forced = false, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const { user, changePassword, signOut } = useAuth();
  const confirmRef = useRef(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const policyError = password ? checkPassword(password, user?.email) : '';
  const canSubmit = !busy && password.length > 0 && !policyError && confirm === password;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await changePassword(password);
      setPassword('');
      setConfirm('');
      onDone?.();
    } catch (e) {
      setError(e.message || '비밀번호를 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: Math.max(insets.top, space.xl) + space.lg, paddingBottom: Math.max(insets.bottom, space.xl) }]}
        keyboardShouldPersistTaps="handled"
      >
        {!forced && onClose ? (
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={24} color={colors.ink} />
          </Pressable>
        ) : null}

        <View style={styles.head}>
          <View style={styles.lock}>
            <Icon name="lock-closed" size={26} color={colors.tram} />
          </View>
          <Text style={styles.title}>{forced ? '새 비밀번호를 정해 주세요' : '비밀번호 변경'}</Text>
          <Text style={styles.sub}>
            {forced
              ? '운영자가 발급한 임시 비밀번호로 로그인하셨어요. 안전을 위해 지금 나만의 비밀번호로 바꿔 주세요.'
              : '새 비밀번호를 입력해 주세요. 바꾼 뒤에도 이 기기는 로그인된 상태로 유지돼요.'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>새 비밀번호</Text>
            <View style={styles.pwWrap}>
              <TextInput
                style={[styles.input, styles.pwInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="8자 이상, 영문+숫자"
                placeholderTextColor={colors.faint}
                secureTextEntry={!show}
                autoCapitalize="none"
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <Pressable onPress={() => setShow((v) => !v)} style={styles.eye} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
                <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
              </Pressable>
            </View>
            {policyError ? <Text style={styles.hintError}>{policyError}</Text> : <Text style={styles.hint}>8자 이상 · 영문자와 숫자를 각각 1개 이상</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>새 비밀번호 확인</Text>
            <TextInput
              ref={confirmRef}
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="한 번 더 입력"
              placeholderTextColor={colors.faint}
              secureTextEntry={!show}
              autoCapitalize="none"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {confirm && confirm !== password ? <Text style={styles.hintError}>비밀번호가 서로 달라요.</Text> : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={submit} disabled={!canSubmit} style={[styles.submit, !canSubmit && styles.submitOff]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{forced ? '비밀번호 변경하고 시작하기' : '비밀번호 변경'}</Text>}
          </Pressable>
        </View>

        {forced ? (
          <Pressable onPress={signOut} style={styles.logout} accessibilityRole="button">
            <Text style={styles.logoutText}>나중에 하기 (로그아웃)</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.xl },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  head: { alignItems: 'center', gap: space.sm },
  lock: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  form: { gap: space.lg },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  input: { height: 52, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, fontSize: 16, color: colors.ink },
  pwWrap: { justifyContent: 'center' },
  pwInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: space.md },
  hint: { fontSize: 12, color: colors.muted },
  hintError: { fontSize: 12, fontWeight: '600', color: colors.danger },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger },
  submit: { height: 54, borderRadius: radius.control, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  submitOff: { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  logout: { alignItems: 'center', paddingVertical: space.md },
  logoutText: { fontSize: 14, fontWeight: '600', color: colors.muted }
});
