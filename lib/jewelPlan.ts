// 사료계산기의 계산 부분. 브라우저·서버 어디서든 쓰도록 외부 호출 없이 숫자만 다룬다.
// 날짜는 모두 한국서버 예상일(일 번호)이다.

import { monthOf, monthStart } from "./dates.ts";
import { LOGIN_BONUS, mondaysBetween, TEAM_TRIALS_WEEKLY, type TeamClass } from "./jewelSources.ts";
import { addRewards, type Materials, type Rewards } from "./rewards.ts";
import { isEventReward } from "./rewardScope.ts";
import { SHEET_REWARDS } from "./sheetRewards.ts";
import { uniqueIncomes } from "./incomeIdentity.ts";

export const JEWELS_PER_PULL = 150;
export const CEILING = 200;

/** 데일리 미션 ⑤ 육성 완료 20 + 전부 클리어 30 (gametora missions/daily) */
export const DAILY_MISSION_JEWELS = 50;

/** 월정액(ウマスク): 구매할 때 유료 500, 30일 동안 매일 무료 50. 2024-12-19 일본서버 판매 시작 (gamebiz.jp/news/396105) */
export const MONTHLY = { paidOnBuy: 500, freePerDay: 50, days: 30 } as const;

/**
 * 트레이닝 패스: 육성으로 모은 포인트(최종 120,000pt)에 따라 받는 보상. 약 한 달마다 새 기간이 열린다.
 * 사용자 시트 '트레이닝 패스' C2:F3의 무료·프리미엄 총량을 사용한다.
 * standard: 누구나 받는 보상, premium: 프리미엄 패스(800엔, 기간마다 1회)를 사면 더 받는 보상
 */
export const TRAINING_PASS = {
  days: 30,
  standard: SHEET_REWARDS.trainingPass.standard,
  premium: {
    paidOnBuy: 350,
    free: SHEET_REWARDS.trainingPass.premium.free - SHEET_REWARDS.trainingPass.standard.free,
    trainTickets: SHEET_REWARDS.trainingPass.premium.trainTickets - SHEET_REWARDS.trainingPass.standard.trainTickets,
    supportTickets: SHEET_REWARDS.trainingPass.premium.supportTickets - SHEET_REWARDS.trainingPass.standard.supportTickets,
    rainbowShards: SHEET_REWARDS.trainingPass.premium.rainbowShards - SHEET_REWARDS.trainingPass.standard.rainbowShards,
  },
} as const;

/**
 * 트레이닝 패스 시작일(한국서버 날짜). 시트 '트레이닝 패스' A열의 회차별 한섭 날짜를 쓰고,
 * 시트의 마지막 회차 뒤로는 30일 간격으로 이어 붙인다. 시트처럼 (오늘, 목표 시작일) 사이에 시작하는 회차만 센다.
 */
export function passStartsBetween(today: number, target: number, dates: readonly number[] = SHEET_REWARDS.trainingPass.datesKr): number[] {
  const starts = dates.filter((d) => d > today && d < target);
  const last = dates[dates.length - 1];
  if (last !== undefined) for (let d = last + TRAINING_PASS.days; d < target; d += TRAINING_PASS.days) if (d > today) starts.push(d);
  return starts;
}

/**
 * 상점 월간 교환: 교환처마다 육성·서포트 가챠 티켓을 한 달에 정해진 횟수만큼 바꿀 수 있다. 매달 1일에 횟수가 초기화된다.
 * 횟수는 1회당 1장이며 육성·서포트가 같다 (game8.jp/umamusume/373403 ショップ一覧, 2025-11 기준)
 */
export const SHOP_MONTHLY = [
  { id: "friend", name: "프렌드 포인트", cost: "20,000pt", perMonth: 1 },
  { id: "rainbow", name: "무지개 편자", cost: "2개", perMonth: 1 },
  { id: "gold", name: "금 편자", cost: "10개", perMonth: 1 },
  { id: "silver", name: "은 편자", cost: "50개", perMonth: 2 },
  { id: "clover", name: "클로버", cost: "200개", perMonth: 2 },
] as const;
export type ShopSource = (typeof SHOP_MONTHLY)[number]["id"];
export const SHOP_SOURCES: ShopSource[] = SHOP_MONTHLY.map((s) => s.id);

/** (오늘, 목표 시작일) 사이에 오는 매달 1일. 이번 달 남은 교환은 이미 했을 수도 있어서 넣지 않는다 */
export function monthStartsBetween(today: number, target: number): number[] {
  const starts: number[] = [];
  let { y, m } = monthOf(today);
  for (let d = monthStart(y, m + 1); d < target; d = monthStart(y, m + 1)) {
    starts.push(d);
    ({ y, m } = monthOf(d));
  }
  return starts;
}

/** none: 패스 보상을 넣지 않음, standard: 무료 보상만 끝까지, premium: 프리미엄 패스를 사고 끝까지 */
export type PassPlan = "none" | "standard" | "premium";

/** limited·story: 기간 한정 미션과 스토리 이벤트, cm·legend·loh: 고른 단계에 따른 대회 보상, gift·login: 운영 선물과 특별 로그인 보너스 */
// Keep the existing UI source groups; detailed event categories live in category.
export type IncomeSource = "limited" | "story" | "cm" | "legend" | "loh" | "gift" | "login";
const COMPETITION: IncomeSource[] = ["cm", "legend", "loh"];
const GIFT: IncomeSource[] = ["gift", "login"];

/** 기간이 정해진 쥬얼·티켓 보상 묶음 하나 (기간 한정 미션, 스토리 이벤트 포인트 보상) */
export type Income = Rewards & {
  id: string;
  source: IncomeSource;
  name: string;
  startKr: number;
  endKr: number;
  /** Original JP dates let split rewards match even when KR dates are confirmed. */
  startJp?: number;
  endJp?: number;
  /** Native limited mission group; distinguishes simultaneous campaigns. */
  eventGroupId?: number;
  loginDay?: number;
  free: number;
  trainTickets: number;
  supportTickets: number;
  category?: string;
  reference?: string;
  condition?: string;
  /** Optional receipt date. Legacy rows are counted on their start date. */
  claimKr?: number;
};

export type PlanInput = Materials & {
  today: number;
  /** 목표 픽업 시작일. 그 전날까지 모은 쥬얼로 계산한다 */
  target: number;
  paid: number;
  free: number;
  trainTickets: number;
  supportTickets: number;
  monthly: boolean;
  pass: PassPlan;
  /** 팀 경기장 클래스. 0이면 넣지 않음 */
  teamClass: TeamClass;
  /** 매달 교환하는 상점 교환처 */
  shop?: ShopSource[];
  incomes: Income[];
  /** Already received or deliberately omitted rewards, by stable ID. */
  excludedIncomeIds?: string[];
};

export type Plan = Materials & {
  days: number;
  daily: number;
  monthlyFree: number;
  monthlyPaid: number;
  /** 트레이닝 패스 기간 수와 그동안 받는 보상 */
  passPeriods: number;
  passFree: number;
  passPaid: number;
  passTrainTickets: number;
  passSupportTickets: number;
  login: number;
  /** 상점 월간 교환: 초기화 횟수와 그동안 바꾸는 티켓 (육성·서포트 같은 수) */
  shopMonths: number;
  shopTickets: number;
  teamWeeks: number;
  teamTrials: number;
  /** 오늘 다음 날부터 목표 시작 전날 사이에 시작하는 보상 */
  incomes: Income[];
  eventFree: number;
  /** 챔피언스 미팅·레전드 레이스·리그 오브 히어로즈 */
  competitionFree: number;
  /** 운영 선물과 특별 로그인 보너스 */
  giftFree: number;
  /** Materials earned in this plan, separate from the starting inventory. */
  earnedMaterials: Materials;
  /** 목표 시작일의 예상 보유량 */
  free: number;
  paid: number;
  trainTickets: number;
  supportTickets: number;
};

/** 오늘 이미 시작한 보상은 받았을 수도 있어서 넣지 않는다. 목표 시작일에 시작하는 보상도 그 픽업에는 늦어서 뺀다 */
export function incomesBetween(incomes: Income[], today: number, target: number): Income[] {
  return uniqueIncomes(incomes).filter((i) => (i.claimKr ?? i.startKr) > today && (i.claimKr ?? i.startKr) < target).sort((a, b) => (a.claimKr ?? a.startKr) - (b.claimKr ?? b.startKr));
}

export function plan(input: PlanInput): Plan {
  const days = Math.max(0, input.target - input.today);
  const excluded = new Set(input.excludedIncomeIds ?? []);
  const incomes = incomesBetween(input.incomes, input.today, input.target).filter(i => isEventReward(i) && !excluded.has(i.id));
  const sum = (key: "free" | "trainTickets" | "supportTickets") => incomes.reduce((a, i) => a + i[key], 0);

  const daily = days * DAILY_MISSION_JEWELS;
  const monthlyFree = input.monthly ? days * MONTHLY.freePerDay : 0;
  const monthlyPaid = input.monthly ? Math.ceil(days / MONTHLY.days) * MONTHLY.paidOnBuy : 0;
  const freeOf = (sources: IncomeSource[]) => incomes.filter((i) => sources.includes(i.source)).reduce((a, i) => a + i.free, 0);
  const competitionFree = freeOf(COMPETITION);
  const giftFree = freeOf(GIFT);
  const eventFree = sum("free") - competitionFree - giftFree;

  const login = Math.floor(days / LOGIN_BONUS.days) * LOGIN_BONUS.jewels;
  const teamWeeks = input.teamClass === 0 ? 0 : mondaysBetween(input.today, input.target);
  const teamTrials = teamWeeks * TEAM_TRIALS_WEEKLY[input.teamClass];

  const passPeriods = input.pass === "none" ? 0 : passStartsBetween(input.today, input.target).length;
  const std = TRAINING_PASS.standard;
  const pre = input.pass === "premium" ? TRAINING_PASS.premium : { paidOnBuy: 0, free: 0, trainTickets: 0, supportTickets: 0 };
  const passFree = passPeriods * (std.free + pre.free);
  const passPaid = passPeriods * pre.paidOnBuy;
  const passTrainTickets = passPeriods * (std.trainTickets + pre.trainTickets);
  const passSupportTickets = passPeriods * (std.supportTickets + pre.supportTickets);
  const shop = new Set(input.shop ?? []);
  const shopPerMonth = SHOP_MONTHLY.filter((s) => shop.has(s.id)).reduce((a, s) => a + s.perMonth, 0);
  const shopMonths = shopPerMonth > 0 ? monthStartsBetween(input.today, input.target).length : 0;
  const shopTickets = shopMonths * shopPerMonth;
  const earnedMaterials = addRewards([...incomes, { free: 0, trainTickets: 0, supportTickets: 0, rainbowShards: input.pass === "premium" ? passPeriods * TRAINING_PASS.premium.rainbowShards : 0 }]);
  const materialTotals = addRewards([earnedMaterials, { ...input, free: 0, trainTickets: 0, supportTickets: 0 }]);

  return {
    rainbowCrystals: materialTotals.rainbowCrystals,
    rainbowShards: materialTotals.rainbowShards,
    goldCrystals: materialTotals.goldCrystals,
    goldShards: materialTotals.goldShards,
    specialTickets: materialTotals.specialTickets,
    earnedMaterials,
    days,
    daily,
    monthlyFree,
    monthlyPaid,
    passPeriods,
    passFree,
    passPaid,
    passTrainTickets,
    passSupportTickets,
    incomes,
    eventFree,
    competitionFree,
    login,
    shopMonths,
    shopTickets,
    teamWeeks,
    teamTrials,
    giftFree,
    free: input.free + daily + monthlyFree + passFree + eventFree + competitionFree + giftFree + login + teamTrials,
    paid: input.paid + monthlyPaid + passPaid,
    trainTickets: input.trainTickets + passTrainTickets + shopTickets + sum("trainTickets"),
    supportTickets: input.supportTickets + passSupportTickets + shopTickets + sum("supportTickets"),
  };
}

/** 목표 픽업에서 돌릴 수 있는 횟수. 유료 전용 가챠는 유료 쥬얼만 쓰고 티켓은 못 쓴다 */
export function pullsFor(p: Plan, lane: "train" | "support", paidOnly: boolean) {
  if (paidOnly) {
    const fromJewels = Math.floor(p.paid / JEWELS_PER_PULL);
    return { fromJewels, fromTickets: 0, total: fromJewels };
  }
  const fromJewels = Math.floor((p.free + p.paid) / JEWELS_PER_PULL);
  const fromTickets = lane === "train" ? p.trainTickets : p.supportTickets;
  return { fromJewels, fromTickets, total: fromJewels + fromTickets };
}
