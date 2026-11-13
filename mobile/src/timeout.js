/** 응답이 오지 않는 작업(위치·네트워크)이 화면을 영원히 멈추게 하지 않도록 제한 시간을 둔다 */
export function withTimeout(promise, ms, message = '응답이 없어요. 잠시 뒤 다시 시도해 주세요.') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
