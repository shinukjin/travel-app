<template>
  <main class="login">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <span class="brand-mark">HG</span>
        <div>
          <strong>Honeymoon Guide</strong>
          <span>여행 준비 웹</span>
        </div>
      </div>

      <div class="login-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="!signup" :class="{ active: !signup }" @click="setMode('login')">로그인</button>
        <button type="button" role="tab" :aria-selected="signup" :class="{ active: signup }" @click="setMode('signup')">회원가입</button>
      </div>

      <p class="lead">
        {{ signup ? '계정을 만들면 앱과 같은 데이터를 어디서든 볼 수 있어요.' : '여행 데이터는 본인 계정으로만 볼 수 있어요.' }}
      </p>

      <p v-if="!supabaseConfigured" class="login-warn">
        Supabase 설정이 없습니다. <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> 환경 변수를
        설정한 뒤 다시 실행해 주세요. (docs/배포-가이드.md 참고)
      </p>

      <p v-if="notice" class="login-notice">{{ notice }}</p>

      <div class="form-row">
        <label for="email">이메일</label>
        <input id="email" v-model.trim="email" type="email" autocomplete="username" required autofocus />
      </div>
      <div class="form-row">
        <label for="password">비밀번호<span v-if="signup" class="login-hint"> ({{ MIN_PASSWORD }}자 이상)</span></label>
        <input
          id="password"
          v-model="password"
          type="password"
          :autocomplete="signup ? 'new-password' : 'current-password'"
          :minlength="signup ? MIN_PASSWORD : undefined"
          required
        />
      </div>
      <div v-if="signup" class="form-row">
        <label for="confirm">비밀번호 확인</label>
        <input id="confirm" v-model="confirm" type="password" autocomplete="new-password" required />
        <span v-if="confirm && confirm !== password" class="login-hint-error">비밀번호가 서로 다릅니다.</span>
      </div>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button type="submit" class="login-submit" :disabled="!canSubmit">
        {{ busy ? (signup ? '가입 중…' : '로그인 중…') : signup ? '가입하기' : '로그인' }}
      </button>

      <p class="login-foot">
        {{ signup ? '계정마다 여행 데이터가 따로 저장됩니다.' : '처음이라면 회원가입 탭에서 계정을 만들어 주세요.' }}
      </p>
    </form>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { signIn, signUp } from '../auth';
import { supabaseConfigured } from '../supabase';

const MIN_PASSWORD = 8;
const route = useRoute();
const router = useRouter();
const mode = ref('login');
const email = ref('');
const password = ref('');
const confirm = ref('');
const busy = ref(false);
const error = ref('');
const notice = ref('');

const signup = computed(() => mode.value === 'signup');
const canSubmit = computed(
  () =>
    supabaseConfigured &&
    !busy.value &&
    email.value.length > 3 &&
    password.value.length >= (signup.value ? MIN_PASSWORD : 1) &&
    (!signup.value || confirm.value === password.value)
);

function setMode(next) {
  mode.value = next;
  error.value = '';
  notice.value = '';
  confirm.value = '';
}

async function submit() {
  if (!canSubmit.value) return;
  error.value = '';
  notice.value = '';
  busy.value = true;
  try {
    if (signup.value) {
      const { needsConfirm } = await signUp(email.value, password.value);
      if (needsConfirm) {
        // 이메일 확인이 켜져 있으면 메일의 링크를 누른 뒤 로그인해야 한다
        setMode('login'); // 탭을 바꾸면 안내가 지워지므로, 그 뒤에 다시 설정한다
        notice.value = '가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.';
        return;
      }
    } else {
      await signIn(email.value, password.value);
    }
    router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
