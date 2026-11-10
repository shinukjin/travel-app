<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">계정</p>
        <h2>내 비밀번호 변경</h2>
        <p class="lead">로그인한 운영자 계정({{ session?.user?.email }})의 비밀번호를 바꿉니다.</p>
      </div>
    </div>

    <p v-if="mustChangePassword" class="login-warn">
      <strong>비밀번호를 변경해야 계속 사용할 수 있어요.</strong> 임시 비밀번호로 로그인하셨다면 지금 새 비밀번호를 정해 주세요.
    </p>
    <p v-if="done" class="flash">비밀번호를 변경했습니다.</p>

    <form class="panel pw-card" @submit.prevent="submit">
      <div class="form-row">
        <label for="pw-new">새 비밀번호</label>
        <input id="pw-new" v-model="password" :type="show ? 'text' : 'password'" autocomplete="new-password" required />
        <span class="muted">8자 이상 · 영문자와 숫자를 각각 1개 이상</span>
      </div>
      <div class="form-row">
        <label for="pw-confirm">새 비밀번호 확인</label>
        <input id="pw-confirm" v-model="confirm" :type="show ? 'text' : 'password'" autocomplete="new-password" required />
        <span v-if="confirm && confirm !== password" class="login-hint-error">비밀번호가 서로 달라요.</span>
      </div>
      <label class="ud-check"><input v-model="show" type="checkbox" /> 비밀번호 보기</label>

      <p v-if="error" class="login-error">{{ error }}</p>

      <div class="actions">
        <button type="submit" :disabled="busy || !canSubmit">{{ busy ? '변경 중…' : '비밀번호 변경' }}</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminApi } from '../adminApi';
import { mustChangePassword, session } from '../auth';
import { checkPassword } from '../password';

const router = useRouter();
const password = ref('');
const confirm = ref('');
const show = ref(false);
const busy = ref(false);
const error = ref('');
const done = ref(false);

const canSubmit = computed(() => password.value.length > 0 && password.value === confirm.value);

async function submit() {
  error.value = checkPassword(password.value, session.value?.user?.email);
  if (error.value) return;
  busy.value = true;
  try {
    await adminApi.changeMyPassword(password.value);
    const wasForced = mustChangePassword.value;
    mustChangePassword.value = false;
    password.value = '';
    confirm.value = '';
    done.value = true;
    if (wasForced) router.replace('/');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.pw-card { max-width: 460px; padding: 20px; }
</style>
