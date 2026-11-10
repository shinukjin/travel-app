/** CSV 도구 — 한글이 엑셀에서 깨지지 않도록 내보낼 때 BOM 을 붙인다. */

function cell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  // 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다. 수식으로 해석될 수 있는 시작 문자(=,+,-,@)는 앞에 ' 를 붙여 막는다.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** columns: [{ key, label }] — rows 의 key 값을 순서대로 CSV 로 만든다 */
export function toCsv(rows, columns) {
  const head = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv(filename, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 첫 줄에서 쉼표·탭·세미콜론 중 가장 많이 나온 것을 구분자로 본다 (따옴표 안은 제외). 모두 없으면 쉼표. */
export function detectDelimiter(src) {
  const line = String(src || '').split(/\r?\n/).find((l) => l.trim() !== '') || '';
  const counts = { ',': 0, '\t': 0, ';': 0 };
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] === ',' ? -1 : 1))[0];
  return n === 0 ? ',' : best;
}

/**
 * 파일을 읽어 글자 인코딩을 자동으로 판별한다.
 * 한국어 엑셀의 "CSV (쉼표로 분리)" 는 UTF-8 이 아니라 EUC-KR(CP949) 로 저장되므로, UTF-8 로 읽어 보고
 * 깨지면 EUC-KR 로 다시 읽는다. (UTF-16 "유니코드 텍스트" 도 BOM 으로 인식)
 * 돌려주는 값: { text, encoding }
 */
export async function readTextFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'UTF-16' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'UTF-16' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('euc-kr').decode(bytes), encoding: 'EUC-KR (엑셀 기본)' };
  }
}

/** CSV 텍스트 → 행 배열 (따옴표·구분자·줄바꿈 처리). 구분자는 자동 감지. 빈 줄은 건너뛴다. */
export function parseCsv(text, delimiter) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const delim = delimiter || detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
