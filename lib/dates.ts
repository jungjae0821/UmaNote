// 날짜는 "일 번호"(1970-01-01부터 센 날 수)로 다룬다. 서버 시간대는 일본·한국 모두 UTC+9.
export const SERVER_GAP_DAYS = 476;

const DAY = 86_400;
const UTC9 = 9 * 3600;

/** 일본서버 유닉스 타임스탬프(초) → UTC+9 기준 일 번호 */
export function dayFromTimestamp(ts: number): number {
  return Math.floor((ts + UTC9) / DAY);
}

/** 지금 이 순간의 한국 날짜 일 번호 */
export function todayKr(now = Date.now()): number {
  return dayFromTimestamp(Math.floor(now / 1000));
}

export const jpToKr = (jpDay: number) => jpDay + SERVER_GAP_DAYS;
export const krToJp = (krDay: number) => krDay - SERVER_GAP_DAYS;

function parts(day: number) {
  const d = new Date(day * DAY * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() };
}

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 11.10 */
export function formatShort(day: number): string {
  const p = parts(day);
  return `${pad(p.m)}.${pad(p.d)}`;
}

/** 2025.07.22 */
export function formatFull(day: number): string {
  const p = parts(day);
  return `${p.y}.${pad(p.m)}.${pad(p.d)}`;
}

/** 2026년 11월 3일 화요일 */
export function formatLong(day: number): string {
  const p = parts(day);
  return `${p.y}년 ${p.m}월 ${p.d}일 ${WEEKDAYS[p.w]}요일`;
}

/** D-7, D-Day */
export function formatDday(diff: number): string {
  return diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
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

/** 화 */
export function weekday(day: number): string {
  return WEEKDAYS[parts(day).w];
}
