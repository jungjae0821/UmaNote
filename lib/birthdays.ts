import { monthOf, monthStart } from "./dates";
import type { Character } from "./gametora";

export type Birthday = { charId: number; name: string; month: number; day: number; until: number };

/** 오늘(포함) 이후 가장 가까운 생일 순. 한국서버에서 육성할 수 있는 캐릭터만 */
export function upcomingBirthdays(characters: Character[], today: number, limit: number): Birthday[] {
  const { y } = monthOf(today);
  return characters
    .filter((c) => c.playableKr)
    .map((c) => {
      let day = monthStart(y, c.birthMonth) + c.birthDay - 1;
      if (day < today) day = monthStart(y + 1, c.birthMonth) + c.birthDay - 1;
      return { charId: c.charId, name: c.name, month: c.birthMonth, day: c.birthDay, until: day - today };
    })
    .sort((a, b) => a.until - b.until || a.name.localeCompare(b.name, "ko"))
    .slice(0, limit);
}
