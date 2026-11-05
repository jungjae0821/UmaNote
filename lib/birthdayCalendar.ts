import { monthOf, monthStart } from "./dates.ts";

// 생일달력은 1월~6월만 다룬다 (README 고정 범위)
export const FIRST_MONTH = 1;
export const LAST_MONTH = 6;

export type Birthday = {
  id: number;
  name: string;
  month: number;
  day: number;
  icon: string;
};

export const inRange = (m: number) => m >= FIRST_MONTH && m <= LAST_MONTH;

/** 그 달이 다음에 오는 해. 이번 달은 올해로 친다 */
export function yearFor(month: number, today: number): number {
  const now = monthOf(today);
  return month < now.m ? now.y + 1 : now.y;
}

/** 처음 열 달: 오늘이 범위 안이면 이번 달, 아니면 다음에 오는 1월 */
export function defaultMonth(today: number): number {
  const { m } = monthOf(today);
  return inRange(m) ? m : FIRST_MONTH;
}

/** 오늘을 포함해 가장 가까운 생일 날짜(일 번호)와 그날 생일인 사람들 */
export function nextBirthdays(list: Birthday[], today: number): { day: number; people: Birthday[] } | null {
  let best: number | null = null;
  for (const b of list) {
    if (!inRange(b.month)) continue;
    let day = monthStart(monthOf(today).y, b.month) + b.day - 1;
    if (day < today) day = monthStart(monthOf(today).y + 1, b.month) + b.day - 1;
    if (best === null || day < best) best = day;
  }
  if (best === null) return null;
  const at = best;
  const { m } = monthOf(at);
  const d = at - monthStart(monthOf(at).y, m) + 1;
  return { day: at, people: list.filter((b) => b.month === m && b.day === d) };
}

export type Cell = { day: number; date: number; people: Birthday[] };

/** 달력 칸: 그달 1일 앞의 빈칸 수와 날짜별 생일자 */
export function monthCells(list: Birthday[], year: number, month: number): { lead: number; cells: Cell[] } {
  const first = monthStart(year, month);
  const length = monthStart(year, month + 1) - first;
  // 1970-01-01(일 번호 0)은 목요일
  const lead = (first + 4) % 7;
  const cells = Array.from({ length }, (_, i) => ({
    day: first + i,
    date: i + 1,
    people: list.filter((b) => b.month === month && b.day === i + 1),
  }));
  return { lead, cells };
}

// 나무위키 '우마무스메 프리티 더비/우마무스메 분류' 인덱스 번호 기준 NPC(트레센 학원 관계자 등):
// 2001~2008(해피 미쿠, 몬쥬 등), 9001~(하야카와 타즈나, 삼대 시조 등), 그리고 앞자리가 1인데도 NPC인 카지노 드라이브(1139).
// 9052 아즈마는 그 표에 아직 없지만 같은 9000번대라 NPC로 친다
const NPC_IN_PC_RANGE = new Set([1139]);

/** 게임 캐릭터 ID로 NPC인지. ID가 없으면 판단할 수 없어 NPC가 아닌 것으로 본다 */
export function isNpc(charaId: number | null): boolean {
  if (charaId === null) return false;
  return charaId >= 2000 || NPC_IN_PC_RANGE.has(charaId);
}
