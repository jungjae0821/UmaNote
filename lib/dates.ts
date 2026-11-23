// 날짜는 "일 번호"(1970-01-01부터 센 날 수)로 다룬다. 한국서버 시간대는 UTC+9.
const DAY = 86_400;
const UTC9 = 9 * 3600;

/** 유닉스 타임스탬프(초) → UTC+9 기준 일 번호 */
export function dayFromTimestamp(ts: number): number {
  return Math.floor((ts + UTC9) / DAY);
}

/** 지금 이 순간의 한국 날짜 일 번호 */
export function todayKr(now = Date.now()): number {
  return dayFromTimestamp(Math.floor(now / 1000));
}

/**
 * 일본서버가 한국서버보다 앞선 날 수. 한국서버 일정 데이터가 없는 운영 선물(일본 공지)을
 * 한국서버 예상일로 옮길 때만 쓴다
 */
export const SERVER_GAP_DAYS = 476;

function parts(day: number) {
  const d = new Date(day * DAY * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() };
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 11/19 */
export function formatMd(day: number): string {
  const p = parts(day);
  return `${p.m}/${p.d}`;
}

/** 2026년 11월 23일 (월) */
export function formatLong(day: number): string {
  const p = parts(day);
  return `${p.y}년 ${p.m}월 ${p.d}일 (${WEEKDAYS[p.w]})`;
}

/** 2026.11.23 */
export function formatFull(day: number): string {
  const p = parts(day);
  return `${p.y}.${String(p.m).padStart(2, "0")}.${String(p.d).padStart(2, "0")}`;
}

/** 11/19 12:00 (타임스탬프 기준, UTC+9) */
export function formatMdTime(ts: number): string {
  const d = new Date((ts + UTC9) * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** 그 달 1일의 일 번호 (month는 1–12, 넘치면 다음 해로) */
export function monthStart(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month - 1, 1) / (DAY * 1000));
}

/** 일 번호가 속한 해와 달 */
export function monthOf(day: number): { y: number; m: number } {
  const p = parts(day);
  return { y: p.y, m: p.m };
}

export function dayOfMonth(day: number): number {
  return parts(day).d;
}

/** 0 = 일요일 */
export function weekdayIndex(day: number): number {
  return parts(day).w;
}

export function weekday(day: number): string {
  return WEEKDAYS[parts(day).w];
}

/**
 * 진행 상태와 상대 시간 문구.
 * 진행 중이면 "n일 남음"(마지막 날이면 "오늘 종료"), 시작 전이면 "n일 후 시작"(내일이면 "내일 시작"), 끝났으면 "종료"
 */
export function relative(startDay: number, endDay: number, today: number): { state: "live" | "soon" | "ended"; text: string } {
  if (today < startDay) {
    const n = startDay - today;
    return { state: "soon", text: n === 1 ? "내일 시작" : `${n}일 후 시작` };
  }
  if (today <= endDay) {
    const n = endDay - today;
    return { state: "live", text: n === 0 ? "오늘 종료" : `${n}일 남음` };
  }
  return { state: "ended", text: "종료" };
}

/** 생일·날짜까지 남은 날: 오늘 / 내일 / n일 후 */
export function untilText(n: number): string {
  return n === 0 ? "오늘" : n === 1 ? "내일" : `${n}일 후`;
}

/** D-7, D-Day */
export function formatDday(diff: number): string {
  return diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
