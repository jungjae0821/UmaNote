import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applySheetRewards, applySheetSchedule, SHEET_REWARDS, sheetCmReward, sheetLohReward } from "../lib/sheetRewards.ts";
import { catalogIncomes, mergeIncomes, type RewardRecord } from "../lib/rewardCatalog.ts";
import { supplementalIncomes } from "../lib/rewardSupplement.ts";
import { competitionIncomes, EMPTY_COMPETITION, giftIncomes, type CmResult } from "../lib/jewelSources.ts";
import { plan, type PlanInput } from "../lib/jewelPlan.ts";

const snapshot = JSON.parse(readFileSync(new URL("../lib/data/rewards.json", import.meta.url), "utf8")) as { rows: RewardRecord[] };
const baseline = mergeIncomes(catalogIncomes(snapshot.rows), supplementalIncomes());
const applied = applySheetRewards(baseline);
const base: PlanInput = { today: 100, target: 130, paid: 0, free: 0, trainTickets: 0, supportTickets: 0, monthly: false, pass: "none", teamClass: 0, incomes: [] };

test("사용자 시트 206개 개최 행과 패스 2종을 보존한다", () => {
  assert.equal(SHEET_REWARDS.rows.length, 206);
  assert.deepEqual(Object.fromEntries([...new Set(SHEET_REWARDS.rows.map(r => r.category))].map(c => [c, SHEET_REWARDS.rows.filter(r => r.category === c).length])),
    { cm: 20, loh: 11, story: 23, legend: 26, research: 20, exam: 8, masters: 9, g1: 64, "character-story": 25 });
  for (const r of SHEET_REWARDS.rows.filter(r => !["cm", "loh", "legend"].includes(r.category))) {
    const income = applied.find(i => i.id === r.id)!;
    assert.ok(income, `${r.sheet}!${r.row}`);
    for (const key of ["free", "trainTickets", "supportTickets", "rainbowShards", "startKr"] as const) assert.equal(income[key], r[key], `${r.sheet}!${r.row} ${key}`);
  }
});

test("스토리·인자연구·기능시험·마스터즈 합계를 교체하고 부속 미션을 중복 계산하지 않는다", () => {
  assert.equal(applied.find(r => r.id === "sheet-story-3")!.free, 2910);
  assert.equal(applied.find(r => r.id === "sheet-exam-2")!.free, 2000);
  assert.equal(applied.find(r => r.id === "sheet-research-3")!.free, 1200);
  assert.equal(applied.find(r => r.id === "sheet-masters-3")!.free, 4500);
  assert.ok(!applied.some(r => ["story-1034", "exam-6", "exam-first-clear-6", "mission-2200142", "research-5", "masters-2"].includes(r.id)));
  // Different transliterations in the workbook must not duplicate the character.
  assert.ok(!applied.some(r => ["character-story-1121", "character-story-1117", "character-story-1079"].includes(r.id)));
  assert.ok(applied.some(r => r.id === "character-story-1073")); // New character absent from the workbook.
  assert.deepEqual(applySheetRewards(applied), applied);
});

test("기존 운영 선물·로그인·보상표가 없는 종류는 유지한다", () => {
  for (const r of baseline.filter(r => r.id === "operator-news-3555" || r.startKr < 20000 || r.category === "carnival-first-clear")) {
    if (r.category === "research" || r.category === "exam" || r.category === "exam-first-clear" || r.category === "masters") continue;
    assert.deepEqual(applied.find(i => i.id === r.id), r);
  }
  assert.ok(giftIncomes().length > 0);
});

test("챔미는 현재 시트 선택값으로 고정하지 않고 인상 전후 24개 순위 값을 그대로 쓴다", () => {
  for (const table of ["before", "after"] as const) for (const league of ["grade", "open"] as const)
    for (const [index, result] of (["A1", "A2", "A3", "B1", "B2", "B3"] as CmResult[]).entries()) {
      assert.deepEqual(sheetCmReward(league, result, table), SHEET_REWARDS.cm[table][index + (league === "open" ? 6 : 0)]);
    }
  assert.equal(sheetCmReward("grade", "A1", "before").free, 2500);
  assert.equal(sheetCmReward("grade", "A1", "after").free, 3000);
  for (const table of ["before", "after"] as const) for (let rank = 12; rank <= 15; rank++) assert.deepEqual(sheetLohReward(rank, table), SHEET_REWARDS.loh[table][15 - rank]);
});

test("시트의 대회 일정과 선택 보상을 연결하고 레전드는 회당 500주얼·무지개 1개만 계산한다", () => {
  const first = SHEET_REWARDS.rows.find(r => r.category === "legend")!;
  const schedule = applySheetSchedule([{ id: "feed-legend", kind: "legend", name: "old", startKr: first.startKr - 1, endKr: first.startKr + 5, raceStartsKr: [first.startKr - 1, first.startKr + 2] }]);
  assert.equal(schedule.length, 57);
  assert.equal(schedule.filter(s => s.id === "feed-legend").length, 1);
  const incomes = competitionIncomes(schedule, { ...EMPTY_COMPETITION, legendRace: true, cmResult: "A1", lohRank: 15 });
  const legends = incomes.filter(r => r.source === "legend");
  assert.equal(legends.length, 26);
  for (const r of legends) { assert.equal(r.free, 500); assert.equal(r.rainbowShards, 1); }
  assert.equal(competitionIncomes(schedule, EMPTY_COMPETITION).length, 0);
  assert.equal(incomes.find(r => r.id === "sheet-cm-2")!.free, 2500);
  assert.equal(incomes.find(r => r.id === "sheet-loh-2")!.free, 3750);
  const duplicateMission = { id: "legend-mission", category: "missions/legendrace-limited", source: "limited" as const, name: "レジェンドレース", startKr: first.startKr - 1, endKr: first.startKr + 5, free: 0, trainTickets: 0, supportTickets: 0, rainbowShards: 1 };
  assert.ok(!applySheetRewards([...baseline, duplicateMission]).some(r => r.id === duplicateMission.id));
});

test("트레이닝 패스 총량은 시트 값이며 일일·로그인·월정액·경기장 수입을 유지한다", () => {
  for (const pass of ["standard", "premium"] as const) {
    const p = plan({ ...base, pass, monthly: true, teamClass: 6 });
    const expected = SHEET_REWARDS.trainingPass[pass];
    assert.equal(p.passFree, expected.free);
    assert.equal(p.passTrainTickets, expected.trainTickets);
    assert.equal(p.passSupportTickets, expected.supportTickets);
    assert.equal(p.earnedMaterials.rainbowShards, expected.rainbowShards);
    assert.equal(p.daily, 1500); assert.equal(p.login, 440);
    assert.equal(p.monthlyFree, 1500); assert.equal(p.monthlyPaid, 500);
    assert.ok(p.teamTrials > 0);
    assert.equal(p.passPaid, pass === "premium" ? 350 : 0);
  }
});
