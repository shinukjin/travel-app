<template>
  <section>
    <div class="page-head">
      <div>
        <p class="crumb">관리자</p>
        <h2>사용자 관리</h2>
        <p class="lead">가입한 계정을 검색하고, 행을 눌러 정보 수정·비밀번호·정지·권한·삭제를 관리합니다. 사용자의 여행·메모 내용은 볼 수 없어요.</p>
      </div>
      <button type="button" @click="openCreate">계정 추가</button>
    </div>

    <p v-if="flash" class="flash">{{ flash }}</p>
    <p v-if="error" class="login-error">{{ error }}</p>

    <div class="panel">
      <div class="toolbar">
        <input v-model.trim="search" class="search" placeholder="이메일·이름·IP 검색" @input="onSearch" />
        <div class="type-filters">
          <button v-for="s in STATUSES" :key="s.id" type="button" class="filter-chip" :class="{ on: status === s.id }" @click="setStatus(s.id)">
            {{ s.label }}
          </button>
        </div>
        <button type="button" class="ghost sm" :disabled="exporting || !total" @click="exportCsv">CSV 내보내기</button>
        <span class="count">{{ total.toLocaleString('ko-KR') }}명</span>
      </div>

      <table class="data clickable">
        <thead>
          <tr>
            <th>사용자</th>
            <th>가입일</th>
            <th>마지막 접속</th>
            <th>최근 IP</th>
            <th class="right">여행</th>
            <th class="right">접속</th>
            <th>상태</th>
            <th class="right">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in rows" :key="u.id" :class="{ 'row-banned': u.banned }" @click="openDrawer(u.id)">
            <td>
              <strong>{{ u.displayName || u.email }}</strong>
              <span v-if="u.isAdmin" class="badge ev-admin">관리자</span>
              <span v-if="u.id === myId" class="badge">나</span>
              <span v-if="u.hasNote" class="badge" title="운영자 메모 있음">메모</span>
              <div v-if="u.displayName" class="muted">{{ u.email }}</div>
            </td>
            <td class="num">{{ fmtDate(u.createdAt) }}</td>
            <td class="num" :title="fmtDateTime(u.lastSignInAt)">{{ fromNow(u.lastSignInAt) }}</td>
            <td class="num">{{ u.lastIp || '-' }}</td>
            <td class="right num">{{ u.tripCount }}</td>
            <td class="right num">{{ u.logCount }}</td>
            <td>
              <span v-if="u.banned" class="badge danger">정지</span>
              <span v-else-if="!u.confirmed" class="badge warn">미인증</span>
              <span v-else class="badge ok">정상</span>
              <span v-if="u.forcePasswordChange" class="badge warn" title="다음 로그인 때 비밀번호 변경 필요">PW 변경 필요</span>
            </td>
            <td class="right" @click.stop>
              <button type="button" class="sm" @click="openDrawer(u.id)">관리</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="8" class="empty">{{ loading ? '불러오는 중…' : '조건에 맞는 사용자가 없습니다.' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <button type="button" class="ghost sm" :disabled="page === 0 || loading" @click="go(page - 1)">이전</button>
        <span class="muted">{{ page + 1 }} / {{ pages }}</span>
        <button type="button" class="ghost sm" :disabled="page + 1 >= pages || loading" @click="go(page + 1)">다음</button>
      </div>
    </div>

    <!-- ───────── 사용자 상세 패널 ───────── -->
    <template v-if="selectedId">
      <div class="drawer-backdrop" @click="closeDrawer"></div>
      <aside class="drawer wide" role="dialog" aria-label="사용자 상세">
        <header>
          <h3>사용자 상세</h3>
          <button type="button" class="ghost sm" @click="closeDrawer">닫기</button>
        </header>

        <div class="drawer-body user-drawer">
          <p v-if="detailLoading" class="muted">불러오는 중…</p>
          <p v-else-if="detailError" class="login-error">{{ detailError }}</p>

          <template v-else-if="detail">
            <p v-if="detail.legacy" class="login-warn">
              IP·비밀번호 상태 같은 일부 정보는 DB 업데이트가 필요해요. Supabase SQL Editor 에서 <code>supabase/migrations/0005_password_ip.sql</code>(0004 이전 파일이 빠졌다면 순서대로)을 실행해 주세요.
            </p>
            <p v-if="drawerFlash" class="flash">{{ drawerFlash }}</p>
            <p v-if="drawerError" class="login-error">{{ drawerError }}</p>

            <div class="ud-summary">
              <div class="ud-title">
                <strong>{{ detail.displayName || detail.email }}</strong>
                <span v-if="detail.isAdmin" class="badge ev-admin">관리자</span>
                <span v-if="detail.banned" class="badge danger">정지</span>
                <span v-else-if="!detail.confirmed" class="badge warn">미인증</span>
                <span v-else class="badge ok">정상</span>
              </div>
              <div v-if="detail.displayName" class="muted">{{ detail.email }}</div>
              <dl class="ud-facts">
                <div><dt>가입일</dt><dd>{{ fmtDateTime(detail.createdAt) }}</dd></div>
                <div><dt>마지막 접속</dt><dd>{{ detail.lastSignInAt ? fmtDateTime(detail.lastSignInAt) : '없음' }}</dd></div>
                <div><dt>이메일 인증</dt><dd>{{ detail.confirmedAt ? fmtDateTime(detail.confirmedAt) : '미인증' }}</dd></div>
                <div><dt>여행 / 접속</dt><dd>{{ detail.tripCount }}개 / {{ detail.logCount }}회</dd></div>
              </dl>
            </div>

            <!-- 정보 수정 -->
            <h4 class="ud-h">정보 수정</h4>
            <form class="ud-form" @submit.prevent="saveProfile">
              <div class="form-row">
                <label for="ud-name">표시 이름 <span class="muted">(운영자만 보이는 이름)</span></label>
                <input id="ud-name" v-model="form.displayName" maxlength="60" placeholder="예: 김민수" />
              </div>
              <div class="form-row">
                <label for="ud-email">이메일</label>
                <input id="ud-email" v-model.trim="form.email" type="email" required />
                <span v-if="emailChanged" class="login-hint-error">이메일을 바꾸면 사용자는 앞으로 새 이메일로 로그인해야 합니다.</span>
              </div>
              <label class="ud-check">
                <input v-model="form.confirmed" type="checkbox" :disabled="detail.id === myId" />
                이메일 인증 완료로 처리
              </label>
              <div class="form-row">
                <label for="ud-note">운영자 메모</label>
                <textarea id="ud-note" v-model="form.note" maxlength="2000" placeholder="문의 내용, 처리 이력 등 (사용자에게 보이지 않아요)"></textarea>
              </div>
              <div class="actions">
                <button type="submit" :disabled="busy || !dirty">{{ busy ? '저장 중…' : '변경 저장' }}</button>
                <button v-if="dirty" type="button" class="ghost" :disabled="busy" @click="resetForm">되돌리기</button>
              </div>
            </form>

            <!-- 정지 -->
            <h4 class="ud-h">계정 정지</h4>
            <div v-if="detail.id === myId || detail.isAdmin" class="muted">
              {{ detail.id === myId ? '자기 자신은 정지할 수 없습니다.' : '관리자 계정은 먼저 관리자 권한을 해제해야 정지할 수 있습니다.' }}
            </div>
            <template v-else-if="detail.banned">
              <div class="ud-ban">
                <strong>정지 중</strong>
                <span>{{ detail.permanent ? '무기한' : `${fmtDateTime(detail.bannedUntil)} 까지` }}</span>
                <span v-if="detail.banReason" class="muted">사유: {{ detail.banReason }}</span>
              </div>
              <div class="actions">
                <button type="button" class="ghost" :disabled="busy" @click="unban">정지 해제</button>
              </div>
            </template>
            <form v-else class="ud-form" @submit.prevent="ban">
              <div class="ud-inline">
                <div class="form-row">
                  <label for="ud-dur">기간</label>
                  <select id="ud-dur" v-model="banForm.duration">
                    <option value="forever">무기한</option>
                    <option value="1">1일</option>
                    <option value="7">7일</option>
                    <option value="30">30일</option>
                    <option value="custom">날짜 지정</option>
                  </select>
                </div>
                <div v-if="banForm.duration === 'custom'" class="form-row">
                  <label for="ud-until">해제 날짜</label>
                  <input id="ud-until" v-model="banForm.date" type="date" :min="tomorrow" required />
                </div>
              </div>
              <div class="form-row">
                <label for="ud-reason">사유 <span class="muted">(선택)</span></label>
                <input id="ud-reason" v-model="banForm.reason" maxlength="300" placeholder="예: 스팸 가입" />
              </div>
              <div class="actions">
                <button type="submit" class="danger" :disabled="busy">정지하기</button>
              </div>
              <p class="muted">정지하면 로그인 중인 기기도 로그아웃되고, 해제 전까지 다시 로그인할 수 없습니다.</p>
            </form>

            <!-- 접속 정보 · IP -->
            <h4 class="ud-h">접속 정보 · IP</h4>
            <dl class="ud-facts">
              <div><dt>최근 IP</dt><dd>{{ detail.lastIp || '-' }}</dd></div>
              <div><dt>최초 IP</dt><dd>{{ detail.firstIp || '-' }}</dd></div>
              <div><dt>최근 기기</dt><dd class="ellipsis" :title="detail.lastDevice">{{ detail.lastDevice || '-' }}</dd></div>
              <div><dt>가입 방식</dt><dd>{{ detail.provider || '-' }}</dd></div>
            </dl>
            <div v-if="detail.platforms.length" class="ud-chips">
              <span v-for="p in detail.platforms" :key="p.platform" class="badge">{{ PLATFORM_LABELS[p.platform] || p.platform }} {{ p.count }}회</span>
            </div>
            <table v-if="detail.ips.length" class="data ud-logs">
              <thead><tr><th>IP</th><th class="right">횟수</th><th>처음</th><th>마지막</th></tr></thead>
              <tbody>
                <tr v-for="ip in detail.ips" :key="ip.ip">
                  <td class="num">{{ ip.ip }}</td>
                  <td class="right num">{{ ip.count }}</td>
                  <td class="num">{{ fmtDateTime(ip.firstSeen) }}</td>
                  <td class="num">{{ fmtDateTime(ip.lastSeen) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted">IP 정보가 있는 접속 기록이 없어요. (환경에 따라 수집되지 않을 수 있어요)</p>

            <!-- 최근 접속 -->
            <h4 class="ud-h">최근 접속 기록</h4>
            <table v-if="detail.recentLogs.length" class="data ud-logs">
              <thead><tr><th>시각</th><th>이벤트</th><th>기기</th><th>IP</th></tr></thead>
              <tbody>
                <tr v-for="l in detail.recentLogs" :key="l.id">
                  <td class="num">{{ fmtDateTime(l.createdAt) }}</td>
                  <td><span class="badge" :class="`ev-${l.event}`">{{ EVENT_LABELS[l.event] || l.event }}</span></td>
                  <td>{{ PLATFORM_LABELS[l.platform] || l.platform }}</td>
                  <td class="num">{{ l.ip || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted">접속 기록이 없습니다.</p>

            <!-- 비밀번호 관리 -->
            <h4 class="ud-h">비밀번호 관리</h4>
            <p v-if="detail.id === myId" class="muted">자기 비밀번호는 상단의 "비밀번호 변경"에서 바꿔 주세요.</p>
            <template v-else>
              <dl class="ud-facts">
                <div><dt>마지막 변경</dt><dd>{{ detail.passwordChangedAt ? fmtDateTime(detail.passwordChangedAt) : '기록 없음' }}</dd></div>
                <div><dt>변경 요구</dt><dd>{{ detail.forcePasswordChange ? '다음 로그인 때 변경해야 함' : '없음' }}</dd></div>
              </dl>

              <div v-if="revealed" class="pw-reveal">
                <strong>임시 비밀번호를 만들었어요</strong>
                <div class="pw-code">{{ revealed.password }}</div>
                <div class="actions">
                  <button type="button" class="sm" @click="copy(revealed.password)">{{ copied ? '복사됨 ✓' : '복사' }}</button>
                  <button type="button" class="ghost sm" @click="revealed = null">닫기</button>
                </div>
                <p class="muted">⚠ 이 창을 닫으면 다시 볼 수 없어요. 사용자에게 안전한 방법으로 전달하세요. 사용자는 로그인 직후 새 비밀번호를 정하게 됩니다. 기존 로그인은 모두 종료됐어요.</p>
              </div>

              <div class="ud-danger">
                <div class="ud-danger-row">
                  <div>
                    <strong>임시 비밀번호로 초기화</strong>
                    <p class="muted">무작위 임시 비밀번호를 만들어 적용하고, 로그인 중인 기기를 모두 로그아웃시킵니다.</p>
                  </div>
                  <button type="button" class="ghost" :disabled="busy" @click="resetToTemp">초기화</button>
                </div>
                <div class="ud-danger-row">
                  <div>
                    <strong>{{ detail.forcePasswordChange ? '비밀번호 변경 요구 해제' : '다음 로그인 때 변경 요구' }}</strong>
                    <p class="muted">켜면 사용자는 로그인 직후 새 비밀번호를 정해야 앱을 쓸 수 있어요.</p>
                  </div>
                  <button type="button" class="ghost" :disabled="busy" @click="toggleForce">{{ detail.forcePasswordChange ? '해제' : '요구하기' }}</button>
                </div>
                <div class="ud-danger-row">
                  <div>
                    <strong>비밀번호 재설정 메일</strong>
                    <p class="muted">{{ detail.email }} 로 재설정 링크를 보냅니다. (사용자가 직접 새 비밀번호를 정해요)</p>
                  </div>
                  <button type="button" class="ghost" :disabled="busy" @click="sendReset">메일 보내기</button>
                </div>
              </div>

              <form class="ud-form pw-direct" @submit.prevent="applyPassword">
                <label for="pw-direct">비밀번호 직접 지정</label>
                <div class="pw-input-row">
                  <input id="pw-direct" v-model="pwForm.value" :type="pwForm.show ? 'text' : 'password'" autocomplete="new-password" placeholder="새 비밀번호 (8자 이상, 영문+숫자)" />
                  <button type="button" class="ghost sm" @click="pwForm.value = generatePassword()">생성</button>
                  <button type="button" class="ghost sm" @click="pwForm.show = !pwForm.show">{{ pwForm.show ? '숨기기' : '보기' }}</button>
                </div>
                <span v-if="pwForm.value && pwCheck" class="login-hint-error">{{ pwCheck }}</span>
                <label class="ud-check"><input v-model="pwForm.force" type="checkbox" /> 다음 로그인 때 사용자가 비밀번호를 바꾸도록 요구</label>
                <div class="actions">
                  <button type="submit" :disabled="busy || !pwForm.value || !!pwCheck">비밀번호 적용</button>
                  <button v-if="pwForm.value" type="button" class="ghost" @click="copy(pwForm.value)">{{ copied ? '복사됨 ✓' : '복사' }}</button>
                </div>
              </form>
            </template>

            <!-- 위험 구역 -->
            <h4 class="ud-h">권한 · 계정 관리</h4>
            <div v-if="detail.id !== myId" class="ud-danger">
              <div class="ud-danger-row">
                <div>
                  <strong>{{ detail.isAdmin ? '관리자 권한 해제' : '관리자 권한 부여' }}</strong>
                  <p class="muted">관리자는 모든 사용자의 계정 정보와 접속 로그를 보고 정지·삭제할 수 있습니다.</p>
                </div>
                <button type="button" class="ghost" :disabled="busy" @click="toggleAdmin">{{ detail.isAdmin ? '해제' : '지정' }}</button>
              </div>
              <div class="ud-danger-row">
                <div>
                  <strong>계정 삭제</strong>
                  <p class="muted">여행·일정·티켓·메모 등 모든 데이터가 함께 삭제되며 되돌릴 수 없습니다.</p>
                </div>
                <button type="button" class="danger" :disabled="busy || detail.isAdmin" :title="detail.isAdmin ? '먼저 관리자 권한을 해제하세요' : ''" @click="remove">삭제</button>
              </div>
            </div>
            <p v-else class="muted">자기 자신의 권한·계정은 여기서 바꿀 수 없습니다.</p>
          </template>
        </div>
      </aside>
    </template>
    <!-- ───────── 계정 추가 ───────── -->
    <template v-if="creating">
      <div class="drawer-backdrop" @click="closeCreate"></div>
      <aside class="drawer wide" role="dialog" aria-label="계정 추가">
        <header>
          <h3>계정 추가</h3>
          <button type="button" class="ghost sm" @click="closeCreate">닫기</button>
        </header>

        <div class="drawer-body user-drawer">
          <div v-if="created" class="pw-reveal">
            <strong>계정을 만들었어요 🎉</strong>
            <dl class="ud-facts">
              <div><dt>이메일</dt><dd>{{ created.email }}</dd></div>
              <div><dt>임시 비밀번호</dt><dd class="pw-code-inline">{{ created.password }}</dd></div>
            </dl>
            <div class="actions">
              <button type="button" class="sm" @click="copy(`${created.email} / ${created.password}`)">{{ copied ? '복사됨 ✓' : '이메일·비밀번호 복사' }}</button>
              <button type="button" class="ghost sm" @click="openCreate">계정 하나 더 추가</button>
            </div>
            <p class="muted">⚠ 이 창을 닫으면 비밀번호를 다시 볼 수 없어요. {{ created.forceChange ? '사용자는 첫 로그인 직후 새 비밀번호를 정하게 됩니다.' : '' }}</p>
          </div>

          <form v-else class="ud-form" @submit.prevent="submitCreate">
            <p v-if="createError" class="login-error">{{ createError }}</p>
            <div class="form-row">
              <label for="cr-email">이메일</label>
              <input id="cr-email" v-model.trim="createForm.email" type="email" required autocomplete="off" placeholder="user@example.com" />
            </div>
            <div class="form-row">
              <label for="cr-pw">임시 비밀번호</label>
              <div class="pw-input-row">
                <input id="cr-pw" v-model="createForm.password" :type="showPw ? 'text' : 'password'" required autocomplete="new-password" />
                <button type="button" class="ghost sm" @click="createForm.password = generatePassword()">다시 생성</button>
                <button type="button" class="ghost sm" @click="showPw = !showPw">{{ showPw ? '숨기기' : '보기' }}</button>
              </div>
              <span v-if="createPwError" class="login-hint-error">{{ createPwError }}</span>
              <span v-else class="muted">8자 이상 · 영문자와 숫자 포함. 자동 생성된 값을 그대로 써도 돼요.</span>
            </div>
            <div class="form-row">
              <label for="cr-name">표시 이름 <span class="muted">(운영자만 보임)</span></label>
              <input id="cr-name" v-model="createForm.displayName" maxlength="60" />
            </div>
            <div class="form-row">
              <label for="cr-note">운영자 메모</label>
              <textarea id="cr-note" v-model="createForm.note" maxlength="2000"></textarea>
            </div>
            <label class="ud-check"><input v-model="createForm.confirmed" type="checkbox" /> 이메일 인증 완료로 처리 (바로 로그인 가능)</label>
            <label class="ud-check"><input v-model="createForm.forceChange" type="checkbox" /> 첫 로그인 때 비밀번호 변경 요구 (권장)</label>
            <label class="ud-check"><input v-model="createForm.makeAdmin" type="checkbox" /> 관리자 권한 부여</label>
            <div class="actions">
              <button type="submit" :disabled="busy || !!createPwError">{{ busy ? '만드는 중…' : '계정 만들기' }}</button>
            </div>
            <p class="muted">Supabase 에서 <b>새 사용자 가입 허용</b>이 켜져 있어야 해요. 이메일 확인이 켜져 있으면 대상에게 확인 메일이 갈 수 있습니다.</p>
          </form>
        </div>
      </aside>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { adminApi } from '../adminApi';
import { session } from '../auth';
import { EVENT_LABELS, PLATFORM_LABELS, fmtDate, fmtDateTime, fromNow } from '../adminFormat';
import { downloadCsv, toCsv } from '../adminCsv';
import { checkPassword, copyText, generatePassword } from '../password';

const PAGE_SIZE = 20;
const STATUSES = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '정상' },
  { id: 'banned', label: '정지' },
  { id: 'unconfirmed', label: '미인증' },
  { id: 'admin', label: '관리자' },
  { id: 'dormant', label: '휴면' },
  { id: 'pwchange', label: '비밀번호 변경 필요' }
];

const route = useRoute();
const myId = computed(() => session.value?.user?.id);

/* ── 목록 ── */
const rows = ref([]);
const total = ref(0);
const page = ref(0);
const search = ref('');
const status = ref(STATUSES.some((s) => s.id === route.query.status) ? route.query.status : 'all');
const loading = ref(false);
const error = ref('');
const flash = ref('');
const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
let timer = null;

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await adminApi.users({ search: search.value, status: status.value, limit: PAGE_SIZE, offset: page.value * PAGE_SIZE });
    rows.value = res.rows;
    total.value = res.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    page.value = 0;
    load();
  }, 300);
}

function setStatus(next) {
  status.value = next;
  page.value = 0;
  load();
}

function go(next) {
  page.value = next;
  load();
}

/* ── 상세 패널 ── */
const selectedId = ref('');
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref('');
const drawerFlash = ref('');
const drawerError = ref('');
const busy = ref(false);
const form = reactive({ displayName: '', email: '', note: '', confirmed: true });
const banForm = reactive({ duration: 'forever', date: '', reason: '' });

const tomorrow = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
});
const emailChanged = computed(() => detail.value && form.email.toLowerCase() !== detail.value.email.toLowerCase());
const dirty = computed(
  () =>
    !!detail.value &&
    (form.displayName.trim() !== (detail.value.displayName || '') ||
      form.email.trim().toLowerCase() !== detail.value.email.toLowerCase() ||
      form.note.trim() !== (detail.value.note || '') ||
      form.confirmed !== detail.value.confirmed)
);

function fillForm() {
  form.displayName = detail.value.displayName || '';
  form.email = detail.value.email;
  form.note = detail.value.note || '';
  form.confirmed = detail.value.confirmed;
}
const resetForm = fillForm;

async function loadDetail(id) {
  detailLoading.value = !detail.value;
  detailError.value = '';
  try {
    const res = await adminApi.getUser(id);
    // 아직 적용하지 않은 마이그레이션이 있으면 새 필드가 없다 → 기본값으로 채우고 안내를 띄운다
    detail.value = {
      ips: [],
      platforms: [],
      recentLogs: [],
      lastIp: null,
      firstIp: null,
      lastDevice: null,
      provider: null,
      passwordChangedAt: null,
      forcePasswordChange: false,
      ...res,
      legacy: !('ips' in res)
    };
    fillForm();
  } catch (e) {
    detailError.value = e.message;
  } finally {
    detailLoading.value = false;
  }
}

function openDrawer(id) {
  revealed.value = null;
  pwForm.value = '';
  selectedId.value = id;
  detail.value = null;
  drawerFlash.value = '';
  drawerError.value = '';
  banForm.duration = 'forever';
  banForm.date = '';
  banForm.reason = '';
  loadDetail(id);
}

function closeDrawer() {
  revealed.value = null;
  selectedId.value = '';
  detail.value = null;
}

/** 동작 실행 → 상세와 목록을 새로고침 */
async function act(fn, message) {
  busy.value = true;
  drawerError.value = '';
  drawerFlash.value = '';
  try {
    await fn();
    drawerFlash.value = message;
    flash.value = message;
    await Promise.all([loadDetail(selectedId.value), load()]);
  } catch (e) {
    drawerError.value = e.message;
  } finally {
    busy.value = false;
  }
}

function saveProfile() {
  act(
    () => adminApi.updateUser(detail.value.id, { email: form.email, displayName: form.displayName, note: form.note, confirmed: form.confirmed }),
    '사용자 정보를 저장했습니다.'
  );
}

function ban() {
  let until = null;
  if (banForm.duration === 'custom') {
    if (!banForm.date) {
      drawerError.value = '해제 날짜를 선택해 주세요.';
      return;
    }
    until = new Date(`${banForm.date}T00:00:00+09:00`).toISOString();
  } else if (banForm.duration !== 'forever') {
    until = new Date(Date.now() + Number(banForm.duration) * 86400000).toISOString();
  }
  const when = until ? `${fmtDateTime(until)} 까지` : '무기한';
  if (!window.confirm(`${detail.value.email} 계정을 ${when} 정지할까요?\n로그인 중인 기기도 로그아웃됩니다.`)) return;
  act(() => adminApi.setBanned(detail.value.id, true, { until, reason: banForm.reason }), '계정을 정지했습니다.');
}

function unban() {
  if (window.confirm(`${detail.value.email} 계정의 정지를 해제할까요?`)) {
    act(() => adminApi.setBanned(detail.value.id, false), '정지를 해제했습니다.');
  }
}

function toggleAdmin() {
  const grant = !detail.value.isAdmin;
  const msg = grant
    ? `${detail.value.email} 계정에 관리자 권한을 줄까요?\n모든 사용자의 계정 정보와 접속 로그를 볼 수 있고, 정지·삭제도 할 수 있습니다.`
    : `${detail.value.email} 계정의 관리자 권한을 해제할까요?`;
  if (window.confirm(msg)) act(() => adminApi.setAdmin(detail.value.id, grant), grant ? '관리자 권한을 부여했습니다.' : '관리자 권한을 해제했습니다.');
}

function sendReset() {
  if (window.confirm(`${detail.value.email} 로 비밀번호 재설정 메일을 보낼까요?`)) {
    act(() => adminApi.sendPasswordReset(detail.value.email), '재설정 메일을 보냈습니다.');
  }
}

async function remove() {
  const email = detail.value.email;
  const typed = window.prompt(
    `${email} 계정을 삭제합니다.\n이 사용자의 여행·일정·티켓·메모가 모두 함께 삭제되며 되돌릴 수 없습니다.\n\n계속하려면 이메일을 정확히 입력하세요.`
  );
  if (typed === null) return;
  if (typed.trim() !== email) {
    drawerError.value = '입력한 이메일이 달라 삭제하지 않았습니다.';
    return;
  }
  busy.value = true;
  try {
    await adminApi.deleteUser(detail.value.id);
    closeDrawer();
    flash.value = '계정을 삭제했습니다.';
    await load();
  } catch (e) {
    drawerError.value = e.message;
  } finally {
    busy.value = false;
  }
}

/* ── CSV 내보내기 (현재 검색·필터 조건 전체) ── */
const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  error.value = '';
  try {
    const all = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const res = await adminApi.users({ search: search.value, status: status.value, limit: 100, offset });
      all.push(...res.rows);
      if (all.length >= res.total || !res.rows.length) break;
    }
    downloadCsv(
      `사용자_${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(all, [
        { label: '이메일', key: 'email' },
        { label: '표시 이름', key: 'displayName' },
        { label: '가입일', value: (r) => fmtDate(r.createdAt) },
        { label: '마지막 접속', value: (r) => (r.lastSignInAt ? fmtDateTime(r.lastSignInAt) : '') },
        { label: '여행 수', key: 'tripCount' },
        { label: '접속 수', key: 'logCount' },
        { label: '상태', value: (r) => (r.banned ? '정지' : !r.confirmed ? '미인증' : '정상') },
        { label: '최근 IP', key: 'lastIp' },
        { label: '비밀번호 변경 필요', value: (r) => (r.forcePasswordChange ? 'Y' : '') },
        { label: '관리자', value: (r) => (r.isAdmin ? 'Y' : '') }
      ])
    );
    flash.value = `${all.length}명을 내보냈습니다.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    exporting.value = false;
  }
}

/* ── 비밀번호 관리 ── */
const revealed = ref(null); // { password } — 임시 비밀번호는 만든 직후 한 번만 보여 준다
const copied = ref(false);
const pwForm = reactive({ value: '', show: false, force: true });
const pwCheck = computed(() => (pwForm.value && detail.value ? checkPassword(pwForm.value, detail.value.email) : ''));

async function copy(text) {
  copied.value = await copyText(text);
  setTimeout(() => (copied.value = false), 1500);
}

async function resetToTemp() {
  const target = detail.value;
  if (!window.confirm(`${target.email} 계정의 비밀번호를 임시 비밀번호로 초기화할까요?\n로그인 중인 기기는 모두 로그아웃되고, 사용자는 새 비밀번호를 정해야 해요.`)) return;
  const password = generatePassword();
  busy.value = true;
  drawerError.value = '';
  drawerFlash.value = '';
  try {
    await adminApi.setPassword(target.id, password, true);
    revealed.value = { password };
    drawerFlash.value = '임시 비밀번호로 초기화했습니다.';
    flash.value = drawerFlash.value;
    await Promise.all([loadDetail(target.id), load()]);
  } catch (e) {
    drawerError.value = e.message;
  } finally {
    busy.value = false;
  }
}

function applyPassword() {
  const target = detail.value;
  if (pwCheck.value) return;
  if (!window.confirm(`${target.email} 계정의 비밀번호를 지정한 값으로 바꿀까요?\n로그인 중인 기기는 모두 로그아웃돼요.`)) return;
  const { value, force } = pwForm;
  act(async () => {
    await adminApi.setPassword(target.id, value, force);
    pwForm.value = '';
  }, '비밀번호를 변경했습니다.');
}

function toggleForce() {
  const next = !detail.value.forcePasswordChange;
  act(() => adminApi.setForcePasswordChange(detail.value.id, next), next ? '다음 로그인 때 비밀번호 변경을 요구합니다.' : '비밀번호 변경 요구를 해제했습니다.');
}

/* ── 계정 추가 ── */
const creating = ref(false);
const created = ref(null);
const createError = ref('');
const showPw = ref(false);
const createForm = reactive({ email: '', password: '', displayName: '', note: '', confirmed: true, forceChange: true, makeAdmin: false });
const createPwError = computed(() => (createForm.password ? checkPassword(createForm.password, createForm.email) : ''));

function openCreate() {
  Object.assign(createForm, { email: '', password: generatePassword(), displayName: '', note: '', confirmed: true, forceChange: true, makeAdmin: false });
  createError.value = '';
  created.value = null;
  showPw.value = true;
  creating.value = true;
}
function closeCreate() {
  creating.value = false;
  created.value = null;
  createForm.password = '';
}

async function submitCreate() {
  createError.value = checkPassword(createForm.password, createForm.email);
  if (createError.value) return;
  busy.value = true;
  try {
    const res = await adminApi.createUser({ ...createForm });
    created.value = { email: res.email, password: createForm.password, forceChange: createForm.forceChange };
    flash.value = '계정을 만들었습니다.';
    await load();
  } catch (e) {
    createError.value = e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
