/** DB 비밀번호 정책과 같은 규칙: 8~72자, 영문자와 숫자 각 1개 이상, 이메일과 같지 않음 */
export function checkPassword(password, email = '') {
  const pw = String(password ?? '');
  if (pw && email && pw.toLowerCase() === String(email).toLowerCase()) return '비밀번호를 이메일과 같게 할 수 없어요.';
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 해요.';
  if (pw.length > 72) return '비밀번호가 너무 길어요 (72자 이하).';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '영문자와 숫자를 각각 1개 이상 넣어 주세요.';
  return '';
}
