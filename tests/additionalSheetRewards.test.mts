import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applySheetRewards, SHEET_REWARDS } from "../lib/sheetRewards.ts";
import { applyAdditionalSheetRewards } from "../lib/additionalSheetRewards.ts";
import { catalogIncomes, mergeIncomes, type RewardRecord } from "../lib/rewardCatalog.ts";
import { supplementalIncomes } from "../lib/rewardSupplement.ts";
import { giftIncomes } from "../lib/jewelSources.ts";
import { plan, type Income, type PlanInput } from "../lib/jewelPlan.ts";

const data = JSON.parse(readFileSync(new URL("../lib/data/rewards.json", import.meta.url), "utf8")) as {rows: RewardRecord[]};
const baseline = mergeIncomes(catalogIncomes(data.rows), supplementalIncomes());
const output = applySheetRewards(baseline);

test("기타 잡사료·시나리오 로그인 238개 고유 행의 날짜와 수량을 그대로 가져온다", () => {
  assert.equal(SHEET_REWARDS.additionalRows.length, 238);
  for (const row of SHEET_REWARDS.additionalRows) {
    const income = output.find(i => i.id === row.id)!;
    assert.ok(income, `${row.sheet}!${row.row}`);
    for (const key of ["free", "trainTickets", "supportTickets", "rainbowShards", "startKr", "startJp", "specialTickets"] as const) assert.deepEqual(income[key], row[key], `${row.id} ${key}`);
  }
  const numberCollab = output.filter(i => i.name.includes("Number") && i.startJp === SHEET_REWARDS.additionalRows.find(r => r.id === "sheet-misc-4")!.startJp);
  assert.equal(numberCollab.length, 1); assert.equal(numberCollab[0].free, 500);
  assert.deepEqual(SHEET_REWARDS.additionalRows.find(r => r.id === "sheet-misc-4")!.duplicateRows, [62]);
  assert.deepEqual(applySheetRewards(output), output);
});

test("시나리오 로그인·미션·평가점과 기념 상점은 각각 한 번만 계산한다", () => {
  assert.equal(output.find(r => r.id === "sheet-campaign-98")!.free, 1500);
  assert.equal(output.find(r => r.id === "sheet-campaign-99")!.free, 500);
  assert.equal(output.find(r => r.id === "sheet-campaign-100")!.free, 300);
  assert.equal(output.find(r => r.id === "sheet-campaign-100")!.rainbowShards, 2);
  assert.ok(!output.some(r => ["login-30197-1", "mission-1002315", "mission-1002318", "mission-1002322", "mission-1002323"].includes(r.id)));
  assert.ok(!output.some(r => r.id === "event-shop-3120010"));
  assert.ok(output.some(r => r.id === "event-shop-3120012")); // Separate dedicated scout tickets remain.
  assert.ok(!output.some(r => r.id === "event-shop-1002002"));
  assert.equal(output.find(r => r.id === "sheet-misc-51")!.rainbowShards, 2);
});

test("주년 로그인은 시트의 일차별 지급일로 교체하고 수동 주년 선물을 중복하지 않는다", () => {
  assert.ok(!output.some(r => r.id.startsWith("login-30207-") || r.id.startsWith("login-30208-")));
  const countdown = output.filter(r => r.id.startsWith("sheet-campaign-") && /4\.5th.*카운트/.test(r.name));
  assert.equal(countdown.length, 10); assert.equal(countdown.reduce((sum, r) => sum + r.free, 0), 1500);
  const day = output.find(r => r.id === "sheet-campaign-115")!.startKr;
  const gifts = [...output, ...giftIncomes()].filter(r => r.source === "gift" && r.startKr === day && r.free === 3000);
  assert.equal(gifts.length, 1);
  const input: PlanInput = { today: countdown[0].startKr - 1, target: countdown[0].startKr + 2, paid: 0, free: 0, trainTickets: 0, supportTickets: 0, monthly: false, pass: "none", teamClass: 0, incomes: countdown };
  assert.equal(plan(input).giftFree, 300); // Only the first two days, never the whole campaign up front.
});

test("기타 점검·콜라보·협동·확정권은 기존 지급분과 중복하지 않는다", () => {
  assert.ok(!output.some(r => r.id === "operator-news-1758"));
  assert.ok(!output.some(r => r.id === "operator-news-2111"));
  assert.ok(output.some(r => r.id === "operator-news-1798")); // A different 50-jewel error compensation on the same day.
  assert.ok(!output.some(r => ["login-30147-1", "login-30183-1"].includes(r.id)));
  assert.ok(!output.some(r => r.id === "raid-summer" || /^event-story-2[678]$/.test(r.id)));
  assert.equal(output.find(r => r.id === "sheet-campaign-28")!.free, 360);
  assert.deepEqual(output.find(r => r.id === "sheet-campaign-28")!.specialTickets, { "SSR 확정권(제4R)": 1 });
  const community = output.find(r => r.id === "raid-summer-community")!;
  assert.ok(Object.keys(community.specialTickets ?? {}).every(k => !k.includes("SSR")));
  assert.ok(Object.keys(community.specialTickets ?? {}).length > 0);
  assert.ok(!output.some(r => r.id === "operator-news-1982"));
  const download = output.find(r => r.id === "sheet-misc-19")!;
  assert.equal(download.supportTickets, 0);
  assert.deepEqual(download.specialTickets, { "SSR 확정권(제4R)": 1 });
});

test("같은 날 같은 금액인 다른 운영 선물과 파카라이브를 삭제하지 않는다", () => {
  const r = SHEET_REWARDS.additionalRows.find(r => r.id === "sheet-campaign-115")!;
  const unrelated: Income[] = [
    { id: "other-download", name: "別のダウンロード記念プレゼント", source: "gift", startJp: r.startJp, startKr: r.startKr, endKr: r.startKr, free: 3000, trainTickets: 0, supportTickets: 0 },
    { id: "broadcast", name: "KFCコラボ情報！ぱかライブTV", source: "gift", startJp: r.startJp, startKr: r.startKr, endKr: r.startKr, free: 500, trainTickets: 0, supportTickets: 0 },
  ];
  const applied = applyAdditionalSheetRewards(unrelated);
  for (const income of unrelated) assert.deepEqual(applied.find(i => i.id === income.id), income);
});
