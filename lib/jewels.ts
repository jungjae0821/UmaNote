import { SHOP_SOURCES, type PassPlan, type ShopSource } from "./jewelPlan";
import { EMPTY_COMPETITION, LOH_RANKS, type CmLeague, type CmResult, type CompetitionInput, type TeamClass } from "./jewelSources";

const CM_RESULTS: CmResult[] = ["none", "out", "B3", "B2", "B1", "A3", "A2", "A1"];

// 보유 쥬얼은 사료계산기에서 입력하고 이 브라우저에 저장한다. 홈은 읽기만 한다.
// 시뮬레이터 기록(umanote:sim:v1)과 같은 "umanote:이름:버전" 규칙
export const JEWELS_KEY = "umanote:jewels:v1";

export type Jewels = { paid: number; free: number };

export function readJewels(): Jewels | null {
  try {
    const raw = localStorage.getItem(JEWELS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Jewels>;
    if (typeof v.paid !== "number" || typeof v.free !== "number") return null;
    return { paid: count(v.paid), free: count(v.free) };
  } catch {
    return null;
  }
}

export function writeJewels(j: Jewels) {
  try {
    localStorage.setItem(JEWELS_KEY, JSON.stringify(j));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 남는다
  }
}

// 쥬얼 외 사료계산기 입력값. 홈 노선도의 '목표' 표시도 이 targetId를 읽는다
export const CALC_KEY = "umanote:calc:v1";

export type CalcInput = CompetitionInput & {
  trainTickets: number;
  supportTickets: number;
  /** 지금 가진 무지개·금 결정 조각 */
  rainbowShards: number;
  goldShards: number;
  monthly: boolean;
  pass: PassPlan;
  /** 매달 교환하는 상점 교환처 */
  shop: ShopSource[];
  /** 목표로 고른 가챠 ID. 고르지 않았으면 null */
  targetId: number | null;
};

export const EMPTY_CALC: CalcInput = {
  ...EMPTY_COMPETITION,
  trainTickets: 0,
  supportTickets: 0,
  rainbowShards: 0,
  goldShards: 0,
  monthly: false,
  pass: "none",
  shop: [],
  targetId: null,
};

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function readCalc(): CalcInput {
  try {
    const raw = localStorage.getItem(CALC_KEY);
    if (!raw) return EMPTY_CALC;
    const v = JSON.parse(raw) as Partial<CalcInput>;
    return {
      trainTickets: count(v.trainTickets),
      supportTickets: count(v.supportTickets),
      rainbowShards: count(v.rainbowShards),
      goldShards: count(v.goldShards),
      monthly: v.monthly === true,
      pass: v.pass === "standard" || v.pass === "premium" ? v.pass : "none",
      shop: Array.isArray(v.shop) ? SHOP_SOURCES.filter((s) => v.shop!.includes(s)) : [],
      teamClass: (count(v.teamClass) <= 6 ? count(v.teamClass) : 0) as TeamClass,
      cmLeague: (v.cmLeague === "open" ? "open" : "grade") as CmLeague,
      cmResult: CM_RESULTS.includes(v.cmResult as CmResult) ? (v.cmResult as CmResult) : "none",
      lohRank: typeof v.lohRank === "number" && v.lohRank >= -1 && v.lohRank < LOH_RANKS.length ? Math.floor(v.lohRank) : -1,
      legendRace: v.legendRace === true,
      targetId: typeof v.targetId === "number" ? v.targetId : null,
    };
  } catch {
    return EMPTY_CALC;
  }
}

export function writeCalc(c: CalcInput) {
  try {
    localStorage.setItem(CALC_KEY, JSON.stringify(c));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 남는다
  }
}

// 사료계산기가 마지막으로 계산한 결과. 홈의 "내 쥬얼"이 읽는다
export const SUMMARY_KEY = "umanote:calc-summary:v1";

export type CalcSummary = {
  targetName: string;
  /** 목표 픽업 시작일(일 번호) */
  targetDay: number;
  /** 그날까지 모이는 무료+유료 쥬얼 */
  jewels: number;
  pulls: number;
};

export function readSummary(): CalcSummary | null {
  try {
    const raw = localStorage.getItem(SUMMARY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CalcSummary>;
    if (typeof v.targetName !== "string" || typeof v.targetDay !== "number" || typeof v.jewels !== "number" || typeof v.pulls !== "number") return null;
    return v as CalcSummary;
  } catch {
    return null;
  }
}

export function writeSummary(s: CalcSummary | null) {
  try {
    if (s) localStorage.setItem(SUMMARY_KEY, JSON.stringify(s));
    else localStorage.removeItem(SUMMARY_KEY);
  } catch {
    // 저장소를 못 쓰면 홈 요약만 빠진다
  }
}
