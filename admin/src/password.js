/**
 * 비밀번호 도구 — DB 의 정책(_check_password)과 같은 규칙을 화면에서 미리 검사한다.
 * 정책: 8~72자, 영문자와 숫자를 각각 1개 이상, 이메일과 같지 않음.
 */
export function checkPassword(password, email = '') {
  const pw = String(password ?? '');
  if (pw && email && pw.toLowerCase() === String(email).toLowerCase()) return '비밀번호를 이메일과 같게 할 수 없어요.';
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 해요.';
  if (new TextEncoder().encode(pw).length > 72) return '비밀번호가 너무 길어요 (영문 기준 72자 이하).';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '영문자와 숫자를 각각 1개 이상 넣어 주세요.';
  return '';
}

// 헷갈리는 글자(0 O 1 l I)는 뺐다. 전달할 때 읽기 쉽게 4자씩 끊는다.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';

function pick(chars, n) {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (v) => chars[v % chars.length]);
}

/** 임시 비밀번호 생성: 예) Kf7m-Qx2p-Rt9w (12자 + 구분 하이픈, 영문·숫자 모두 포함) */
export function generatePassword(groups = 3) {
  const length = groups * 4;
  const digitCount = Math.max(3, Math.floor(length / 4));
  const chars = [...pick(DIGITS, digitCount), ...pick(LETTERS, length - digitCount)];
  // 섞기 (Fisher–Yates, 암호학적 난수)
  const rnd = new Uint32Array(chars.length);
  crypto.getRandomValues(rnd);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const out = [];
  for (let i = 0; i < chars.length; i += 4) out.push(chars.slice(i, i + 4).join(''));
  return out.join('-');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
