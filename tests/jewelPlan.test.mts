import assert from "node:assert/strict";
import { test } from "node:test";
import { passStartsBetween, plan, pullsFor, type Income, type PlanInput } from "../lib/jewelPlan.ts";
import { SHEET_REWARDS } from "../lib/sheetRewards.ts";
import { cmJewels, competitionIncomes, giftIncomes, EMPTY_COMPETITION, lohJewels, mondaysBetween, type Scheduled } from "../lib/jewelSources.ts";

const income = (id: string, startKr: number, free: number, trainTickets = 0, supportTickets = 0): Income => ({
  id,
  source: "limited",
  name: id,
  startKr,
  endKr: startKr + 7,
  free,
  trainTickets,
  supportTickets,
});

const base: PlanInput = {
  today: 100,
  target: 130,
  paid: 0,
  free: 0,
  trainTickets: 0,
  supportTickets: 0,
  monthly: false,
  pass: "none",
  teamClass: 0,
  incomes: [],
};

test("오늘부터 목표 시작 전날까지 데일리 미션 쥬얼을 모은다", () => {
  const p = plan({ ...base, free: 1000 });
  assert.equal(p.days, 30);
  assert.equal(p.daily, 1500);
  assert.equal(p.free, 2500 + 440);
});

test("오늘 시작한 보상과 목표 시작일 이후 보상은 넣지 않는다", () => {
  const p = plan({
    ...base,
    incomes: [income("today", 100, 900), income("in", 101, 150, 1), income("last", 129, 500, 0, 2), income("late", 130, 700)],
  });
  assert.deepEqual(
    p.incomes.map((i) => i.id),
    ["in", "last"],
  );
  assert.equal(p.eventFree, 650);
  assert.equal(p.trainTickets, 1);
  assert.equal(p.supportTickets, 2);
});

test("월정액은 30일마다 유료 500, 매일 무료 50", () => {
  const p = plan({ ...base, target: 131, monthly: true });
  assert.equal(p.monthlyFree, 31 * 50);
  assert.equal(p.monthlyPaid, 1000);
});

test("목표가 오늘이거나 지났으면 늘어나는 쥬얼이 없다", () => {
  const p = plan({ ...base, target: 90, free: 300, monthly: true });
  assert.equal(p.days, 0);
  assert.equal(p.free, 300);
  assert.equal(p.paid, 0);
});

test("유료 전용 가챠는 유료 쥬얼만 쓰고 티켓은 못 쓴다", () => {
  const p = plan({ ...base, target: 100, paid: 450, free: 3000, trainTickets: 5 });
  assert.deepEqual(pullsFor(p, "train", true), { fromJewels: 3, fromTickets: 0, total: 3 });
  assert.deepEqual(pullsFor(p, "train", false), { fromJewels: 23, fromTickets: 5, total: 28 });
  assert.equal(pullsFor(p, "support", false).fromTickets, 0);
});

test("트레이닝 패스는 시트의 회차 시작일마다 무료 보상, 프리미엄은 유료 350과 추가 보상", () => {
  const [first, second] = SHEET_REWARDS.trainingPass.datesKr;
  const window = { today: first - 1, target: second + 1 };
  const std = plan({ ...base, ...window, pass: "standard" });
  assert.equal(std.passPeriods, 2);
  assert.equal(std.passFree, 1000);
  assert.equal(std.passPaid, 0);
  assert.equal(std.trainTickets, 4);

  const pre = plan({ ...base, ...window, pass: "premium" });
  assert.equal(pre.passFree, 2 * (500 + 1350));
  assert.equal(pre.passPaid, 700);
  assert.equal(pre.supportTickets, 8);
  assert.equal(pre.paid, 700);

  assert.equal(plan({ ...base, ...window, pass: "none" }).passFree, 0);
});

test("트레이닝 패스는 오늘·목표 시작일에 시작하는 회차를 빼고, 시트 마지막 회차 뒤로는 30일 간격으로 잇는다", () => {
  const dates = SHEET_REWARDS.trainingPass.datesKr;
  const [first, second] = dates;
  assert.deepEqual(passStartsBetween(first, second), []);
  assert.deepEqual(passStartsBetween(first - 1, first + 1), [first]);
  // 회차 시작 직전이 목표면 30일이 안 돼도 패스를 더하지 않는다
  assert.equal(plan({ ...base, today: first + 1, target: first + 10, pass: "premium" }).passPeriods, 0);
  assert.deepEqual(passStartsBetween(0, 10, []), []);
  const last = dates[dates.length - 1];
  assert.deepEqual(passStartsBetween(last, last + 61), [last + 30, last + 60]);
});

test("로그인 보너스는 7일마다 110", () => {
  const p = plan(base);
  assert.equal(p.login, 4 * 110);
});

test("운영팀 별도 선물도 이벤트 보상에 더한다", () => {
  const gifts = giftIncomes();
  assert.ok(gifts.every((g) => g.free > 0));
  const first = gifts[0];
  const p = plan({ ...base, today: first.startKr - 1, target: first.startKr + 1, incomes: [...gifts, income("ev", first.startKr, 100)] });
  assert.equal(p.giftFree, gifts.filter((g) => g.startKr === first.startKr).reduce((a, g) => a + g.free, 0));
  assert.equal(p.eventFree, 100);
});

test("운영 선물은 중복 없이 합산하고 이벤트 로그인과 구분한다", () => {
  const gifts = giftIncomes();
  const keys = gifts.map((g) => `${g.startKr}|${g.name}`);
  assert.equal(new Set(keys).size, keys.length);
  // Anniversary jewels now come from the user's sheet; don't also return manual copies.
  assert.ok(!gifts.some(g => /^(4\.5|5|5\.5)주년 기념 쥬얼 선물/.test(g.name)));
  assert.ok(gifts.every(g=>g.source==="gift"&&['anniversary-gift','operator-gift'].includes(g.category??'')));
});

test("팀 경기장은 사이에 낀 월요일마다 클래스 보상", () => {
  // 일 번호 4 = 1970-01-05 월요일
  assert.equal(mondaysBetween(4, 11), 0);
  assert.equal(mondaysBetween(3, 12), 2);
  const p = plan({ ...base, today: 3, target: 12, teamClass: 6 });
  assert.equal(p.teamTrials, 500);
});

test("대회 보상은 고른 단계대로, 챔피언스 미팅은 끝나는 날 기준", () => {
  const schedule: Scheduled[] = [
    { kind: "cm", id: "cm-1", name: "", startKr: 110, endKr: 135 },
    { kind: "cm", id: "cm-2", name: "", startKr: 105, endKr: 112 },
    { kind: "legend", id: "lr-1", name: "", startKr: 120, endKr: 127, raceStartsKr: [120, 124] },
    { kind: "legend", id: "lr-2", name: "", startKr: 131, endKr: 136, raceStartsKr: [131, 134] },
    { kind: "loh", id: "loh-1", name: "", startKr: 115, endKr: 124 },
  ];
  const incomes = competitionIncomes(schedule, {
    ...EMPTY_COMPETITION,
    cmResult: "A1",
    lohRank: 11,
    legendRace: true,
  });
  const p = plan({ ...base, incomes });
  assert.deepEqual(
    p.incomes.map((i) => i.id),
    ["cm-2", "lr-1#1", "lr-1#2", "loh-1"],
  );
  // 상대마다 최초 승리 150 + 트로피 최초 획득 100.
  assert.equal(p.competitionFree, cmJewels("grade", "A1", 105) + lohJewels(11) + 250 * 2);
  assert.equal(lohJewels(11), 1750); // 일본 브론즈 2 ~ 골드 4
  assert.equal(p.trainTickets,7); // CM 5 + LOH 2
  assert.equal(p.supportTickets,7);
  assert.equal(p.rainbowShards,1);
  assert.equal(p.goldShards,2);
  assert.equal(p.eventFree, 0);
  assert.equal(competitionIncomes(schedule, EMPTY_COMPETITION).length, 0);
});

test("상점 월간 교환은 (오늘, 목표) 사이 매달 1일마다 고른 교환처 티켓을 더한다", () => {
  // 2026-11-24 → 2027-02-10: 12/1, 1/1, 2/1 세 번
  const today = Date.UTC(2026, 10, 24) / 86_400_000;
  const target = Date.UTC(2027, 1, 10) / 86_400_000;
  const p = plan({ ...base, today, target, shop: ["friend", "silver"] });
  assert.equal(p.shopMonths, 3);
  assert.equal(p.shopTickets, 9);
  assert.equal(p.trainTickets, 9);
  assert.equal(p.supportTickets, 9);
  assert.equal(plan({ ...base, today, target }).shopTickets, 0);
  // 목표가 1일이면 그날 교환분도 넣는다: 12/1, 1/1 두 번
  assert.equal(plan({ ...base, today, target: Date.UTC(2027, 0, 1) / 86_400_000, shop: ["gold"] }).shopMonths, 2);
  // 오늘이 1일이면 그날 교환분은 넣지 않는다
  assert.equal(plan({ ...base, today: Date.UTC(2026, 11, 1) / 86_400_000, target: Date.UTC(2026, 11, 20) / 86_400_000, shop: ["gold"] }).shopMonths, 0);
});
