// 사료계산기의 계산 부분. 브라우저·서버 어디서든 쓰도록 외부 호출 없이 숫자만 다룬다.
// 날짜는 모두 한국서버 예상일(일 번호)이다.

import { LOGIN_BONUS, mondaysBetween, TEAM_TRIALS_WEEKLY, type TeamClass } from "./jewelSources.ts";

export const JEWELS_PER_PULL = 150;
export const CEILING = 200;

/** 데일리 미션 ⑤ 육성 완료 20 + 전부 클리어 30 (gametora missions/daily) */
export const DAILY_MISSION_JEWELS = 50;

/** 월정액(ウマスク): 구매할 때 유료 500, 30일 동안 매일 무료 50. 2024-12-19 일본서버 판매 시작 (gamebiz.jp/news/396105) */
export const MONTHLY = { paidOnBuy: 500, freePerDay: 50, days: 30 } as const;

/**
 * 트레이닝 패스: 육성으로 모은 포인트(최종 120,000pt)에 따라 받는 보상. 약 한 달마다 새 기간이 열린다.
 * 일본서버 2024년 2월 시작. 숫자는 wikiwiki.jp/vip_umamusu 「トレーニングパス」 보상표, game8.jp/umamusume/456096
 * standard: 누구나 받는 보상, premium: 프리미엄 패스(800엔, 기간마다 1회)를 사면 더 받는 보상
 */
export const TRAINING_PASS = {
  days: 30,
  standard: { free: 500, trainTickets: 2, supportTickets: 2 },
  premium: { paidOnBuy: 350, free: 1350, trainTickets: 2, supportTickets: 2 },
} as const;

/** none: 패스 보상을 넣지 않음, standard: 무료 보상만 끝까지, premium: 프리미엄 패스를 사고 끝까지 */
export type PassPlan = "none" | "standard" | "premium";

/** limited·story: 기간 한정 미션과 스토리 이벤트, cm·legend·loh: 고른 단계에 따른 대회 보상, gift·login: 운영 선물과 특별 로그인 보너스 */
export type IncomeSource = "limited" | "story" | "cm" | "legend" | "loh" | "gift" | "login";
const COMPETITION: IncomeSource[] = ["cm", "legend", "loh"];
const GIFT: IncomeSource[] = ["gift", "login"];

/** 기간이 정해진 쥬얼·티켓 보상 묶음 하나 (기간 한정 미션, 스토리 이벤트 포인트 보상) */
export type Income = {
  id: string;
  source: IncomeSource;
  name: string;
  startKr: number;
  endKr: number;
  free: number;
  trainTickets: number;
  supportTickets: number;
};

export type PlanInput = {
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
  incomes: Income[];
};

export type Plan = {
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
  teamWeeks: number;
  teamTrials: number;
  /** 오늘 다음 날부터 목표 시작 전날 사이에 시작하는 보상 */
  incomes: Income[];
  eventFree: number;
  /** 챔피언스 미팅·레전드 레이스·리그 오브 히어로즈 */
  competitionFree: number;
  /** 운영 선물과 특별 로그인 보너스 */
  giftFree: number;
  /** 목표 시작일의 예상 보유량 */
  free: number;
  paid: number;
  trainTickets: number;
  supportTickets: number;
};

/** 오늘 이미 시작한 보상은 받았을 수도 있어서 넣지 않는다. 목표 시작일에 시작하는 보상도 그 픽업에는 늦어서 뺀다 */
export function incomesBetween(incomes: Income[], today: number, target: number): Income[] {
  return incomes.filter((i) => i.startKr > today && i.startKr < target).sort((a, b) => a.startKr - b.startKr);
}

export function plan(input: PlanInput): Plan {
  const days = Math.max(0, input.target - input.today);
  const incomes = incomesBetween(input.incomes, input.today, input.target);
  const sum = (key: "free" | "trainTickets" | "supportTickets") => incomes.reduce((a, i) => a + i[key], 0);

  const daily = days * DAILY_MISSION_JEWELS;
  const monthlyFree = input.monthly ? days * MONTHLY.freePerDay : 0;
  // 오늘 사거나 갱신한다고 보고 30일마다 한 번씩 산다
  const monthlyPaid = input.monthly ? Math.ceil(days / MONTHLY.days) * MONTHLY.paidOnBuy : 0;
  const freeOf = (sources: IncomeSource[]) => incomes.filter((i) => sources.includes(i.source)).reduce((a, i) => a + i.free, 0);
  const competitionFree = freeOf(COMPETITION);
  const giftFree = freeOf(GIFT);
  const eventFree = sum("free") - competitionFree - giftFree;

  const login = Math.floor(days / LOGIN_BONUS.days) * LOGIN_BONUS.jewels;
  const teamWeeks = input.teamClass === 0 ? 0 : mondaysBetween(input.today, input.target);
  const teamTrials = teamWeeks * TEAM_TRIALS_WEEKLY[input.teamClass];

  // 월정액과 같이, 지금 기간부터 30일마다 한 기간씩 보상을 끝까지 받는다고 본다
  const passPeriods = input.pass === "none" ? 0 : Math.ceil(days / TRAINING_PASS.days);
  const std = TRAINING_PASS.standard;
  const pre = input.pass === "premium" ? TRAINING_PASS.premium : { paidOnBuy: 0, free: 0, trainTickets: 0, supportTickets: 0 };
  const passFree = passPeriods * (std.free + pre.free);
  const passPaid = passPeriods * pre.paidOnBuy;
  const passTrainTickets = passPeriods * (std.trainTickets + pre.trainTickets);
  const passSupportTickets = passPeriods * (std.supportTickets + pre.supportTickets);

  return {
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
    teamWeeks,
    teamTrials,
    giftFree,
    free: input.free + daily + monthlyFree + passFree + eventFree + competitionFree + giftFree + login + teamTrials,
    paid: input.paid + monthlyPaid + passPaid,
    trainTickets: input.trainTickets + passTrainTickets + sum("trainTickets"),
    supportTickets: input.supportTickets + passSupportTickets + sum("supportTickets"),
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
