// 보유 쥬얼을 마지막으로 입력한 뒤 지나간 일일 초기화만큼 데일리 미션(과 월정액 일일 지급) 쥬얼을 더한다.
// 브라우저 저장값만 쓰므로 서버나 DB가 필요 없다. 보상 시트를 끌어오지 않게 calcOptions만 가져온다.
import { DAILY_MISSION_JEWELS, MONTHLY } from "./calcOptions.ts";

/** 한국서버 일일 초기화 시각 (한국 시간 05:00) */
export const DAILY_RESET_HOUR = 5;

const DAY_MS = 86_400_000;
const SHIFT_MS = (9 - DAILY_RESET_HOUR) * 3_600_000;

/** 그 시각(ms)이 속한 게임 날짜 번호. 한국 시간 05:00에 다음 날로 넘어간다 */
export function gameDay(ms: number): number {
  return Math.floor((ms + SHIFT_MS) / DAY_MS);
}

/** 그 게임 날짜가 시작하는 시각(ms) */
export function gameDayStart(day: number): number {
  return day * DAY_MS - SHIFT_MS;
}

export function dailyJewels(monthly: boolean): number {
  return DAILY_MISSION_JEWELS + (monthly ? MONTHLY.freePerDay : 0);
}

export type Accrual = { days: number; jewels: number };

/**
 * savedAt에 입력한 뒤 now까지 끝난 게임 날짜 수만큼의 쥬얼.
 * 사료계산기는 오늘 데일리를 앞으로 받을 몫으로 세므로, 입력한 날의 데일리도 그날 초기화가 지나야 더한다.
 * 시계가 뒤로 갔으면 더하지 않는다.
 */
export function accrue(savedAt: number, now: number, monthly: boolean): Accrual {
  const days = Math.max(0, gameDay(now) - gameDay(savedAt));
  return { days, jewels: days * dailyJewels(monthly) };
}
