<template>
  <main class="login">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <span class="brand-mark">HG</span>
        <div>
          <strong>Honeymoon Guide</strong>
          <span>운영 콘솔</span>
        </div>
      </div>

      <span class="console-tag">ADMIN ONLY</span>
      <h2>운영자 로그인</h2>
      <p class="lead">운영자로 등록된 계정만 들어올 수 있어요. 여행 정보를 관리하려면 사용자 웹을 이용해 주세요.</p>

      <p v-if="!supabaseConfigured" class="login-warn">
        Supabase 설정이 없습니다. <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> 환경 변수를
        설정한 뒤 다시 실행해 주세요. (docs/배포-가이드.md 참고)
      </p>

      <div class="form-row">
        <label for="email">이메일</label>
        <input id="email" v-model.trim="email" type="email" autocomplete="username" required autofocus />
      </div>
      <div class="form-row">
        <label for="password">비밀번호</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />
      </div>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button type="submit" class="login-submit" :disabled="busy || !supabaseConfigured">
        {{ busy ? '확인 중…' : '로그인' }}
      </button>
    </form>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { signIn } from '../auth';
import { supabaseConfigured } from '../supabase';

const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await signIn(email.value, password.value);
    router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
