import { SERVER_GAP_DAYS } from "./dates.ts";
import type { Income, IncomeSource } from "./jewelPlan.ts";
import type { Rewards } from "./rewards.ts";
import { isEventReward } from "./rewardScope.ts";

export type RewardRecord = Rewards & {
  id: string; source: string; name: string; startJp: number; endJp: number;
  reference: string; optional?: string; components?: string; condition?: string; evidence?: string[];
};

/** Preserve Japan dates and the calculator's existing UI source groups. */
export function catalogIncomes(records: RewardRecord[]): Income[] {
  return records.filter(isEventReward).map(r => ({
    ...r,
    source: (r.source === "story" ? "story" : r.source === "login" ? "login" : r.source === "operator-gift" || r.source === "anniversary-gift" ? "gift" : "limited") as IncomeSource,
    category: r.source,
    startKr: r.startJp + SERVER_GAP_DAYS,
    endKr: r.endJp + SERVER_GAP_DAYS,
    condition: r.condition ?? (r.source === "login" ? "기간 중 매일 로그인" : r.source === "masters" ? "모든 레이스·난이도 첫 클리어" : "이벤트 보상 및 교환소 재고 전부 획득"),
  }));
}

export function mergeIncomes(base: Income[], incoming: Income[]): Income[] {
  return [...new Map([...base,...incoming].map(r => [r.id,r])).values()].sort((a,b)=>a.startKr-b.startKr||a.id.localeCompare(b.id));
}
