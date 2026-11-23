import assert from "node:assert/strict";
import { test } from "node:test";
import { plannerRewardIncomes } from "../lib/plannerEventSchedule.ts";
import { futureScenarioRewards } from "../lib/futureCampaignRewards.ts";
import { operatorNewsRewards, type OperatorNews } from "../lib/operatorNews.ts";
import { catalogIncomes } from "../lib/rewardCatalog.ts";
import { uniqueIncomes } from "../lib/incomeIdentity.ts";
import { plan, type Income, type PlanInput } from "../lib/jewelPlan.ts";
import { SERVER_GAP_DAYS } from "../lib/dates.ts";

const day = 21000, start = day * 86400;
const base: PlanInput = { today: day + SERVER_GAP_DAYS - 1, target: day + SERVER_GAP_DAYS + 30, paid: 0, free: 0, trainTickets: 0, supportTickets: 0, monthly: false, pass: "none", teamClass: 0, incomes: [] };
const income = (id: string, name: string, source: Income["source"], free = 0): Income => ({ id, name, source, category: source, startJp: day, startKr: day + SERVER_GAP_DAYS, endKr: day + SERVER_GAP_DAYS, free, trainTickets: 0, supportTickets: 0 });
const fixture = (logins: unknown[], missions: unknown[] = [], gifts: unknown[] = []) => {
  const app = 'import{a as A,b as B,c as C,d as D,e as E,f as F}from"./chunks/uma-data.fixture.js";r("Spark Laboratory",A);r("Trainer Aptitude Tests",B);r("Masters Challenges",C);r("Login Bonuses",D);r("Missions",E);r("Anniversary Gifts",F);';
  return [app, `const a=[],b=[],c=[],d=${JSON.stringify(logins)},e=${JSON.stringify(missions)},f=${JSON.stringify(gifts)};export{a,b,c,d,e,f};`] as const;
};

test("일본 특별 로그인 신규 ID·다중 보상은 수동 스냅샷 갱신 없이 일차별 반영한다", () => {
  const args = fixture([{ id: 99001, title: "新キャンペーンログイン", type: 3, start_date: start, end_date: start + 5 * 86400,
    rewards: [{ count: 1, item_name: "Carats", item_num: 150, item_id_2: 149, item_num_2: 1 }, { count: 1, item_id: 111, item_num: 2 }, { count: 3, item_name: "Carats", item_num: 300 }] }]);
  const rows = plannerRewardIncomes(...args);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rainbowShards, 1);
  assert.equal(rows[0].supportTickets, 2);
  assert.equal(rows[1].startKr, day + SERVER_GAP_DAYS + 2);
  assert.equal(plan({ ...base, target: day + SERVER_GAP_DAYS + 2, incomes: rows }).giftFree, 150);
});

test("일반 로그인·컴백·상시 미션·무기한 계정 보상은 새 자동 수집에 섞지 않는다", () => {
  const args = fixture([{ id: 1, title: "通常ログイン", type: 1, start_date: start, end_date: start + 86400, rewards: [{ count: 1, item_id: 43, item_num: 500 }] },
    { id: 2, title: "カムバックログイン", type: 3, start_date: start, end_date: start + 86400, rewards: [{ count: 1, item_id: 43, item_num: 500 }] }],
    [{ id: 3, title: "成長ミッション", mission_type: 1, start_date: start, end_date: start + 86400, item_id: 43, item_num: 500 },
      { id: 4, title: "無期限ミッション", mission_type: 4, start_date: start, end_date: 2000000000, item_id: 43, item_num: 500 }]);
  assert.equal(plannerRewardIncomes(...args).length, 0);
});

test("기간 한정 미션의 변경 수량·그룹 ID를 읽고 새 주년 선물도 수집한다", () => {
  const args = fixture([], [{ id: 9001, title: "新イベント", mission_type: 4, event_id: 101, start_date: start, end_date: start + 86400, item_id: 43, item_num: 450 }],
    [{ id: 6, title: "6th Anniversary Gift", start_date: start, reward_quantity1: 3000 }]);
  const rows = plannerRewardIncomes(...args);
  assert.equal(rows.find(r => r.id === "mission-9001")!.free, 450);
  assert.equal(rows.find(r => r.id === "mission-9001")!.eventGroupId, 101);
  assert.equal(rows.find(r => r.id === "anniversary-gift-6")!.free, 3000);
});

test("새 시나리오가 일본에 공개되면 미션 500·평가점 300을 종류별 시트 값으로 한 번만 붙인다", () => {
  const login = income("login-new-1", "新育成シナリオ「新世界編」公開記念ログインボーナス", "login", 1500);
  const mission = { ...income("mission-new", "新育成シナリオ公開記念ミッション", "limited", 9999), eventGroupId: 101 };
  const component = { ...income("mission-ticket", "新世界編で走ろう", "limited"), trainTickets: 9, eventGroupId: 101 };
  const g1 = { ...income("g1", "GⅠ記念ミッション", "limited", 150), eventGroupId: 102 };
  const out = futureScenarioRewards([mission, component, login, g1]);
  const p = plan({ ...base, incomes: out });
  assert.equal(p.eventFree, 950); assert.equal(p.giftFree, 1500);
  assert.equal(p.trainTickets, 2); assert.equal(p.supportTickets, 2); assert.equal(p.earnedMaterials.rainbowShards, 3);
  assert.equal(out.filter(i => i.id.startsWith("scenario-")).length, 2);
  assert.ok(!out.some(i => i.id === mission.id || i.id === component.id));
  assert.deepEqual(futureScenarioRewards(out), out);
  const nextLogin = { ...login, id: "login-999-3", loginDay: 3, startJp: day + 2, startKr: login.startKr + 2 };
  assert.equal(futureScenarioRewards([...out, nextLogin]).filter(i => i.id.startsWith("scenario-")).length, 2);
});

test("시나리오를 언급한 별도 이벤트·운영 공지에서 가짜 공개 일정을 만들지 않는다", () => {
  const unrelated = [income("event", "シナリオ応援イベント", "limited", 100), income("broadcast", "新育成シナリオ公開情報！ぱかライブ", "gift", 500)];
  assert.deepEqual(futureScenarioRewards(unrelated), [...unrelated].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(futureScenarioRewards([]), []);
});

const news = (id: number, title: string, message: string): OperatorNews => ({ announce_id: id, title, message, post_at: start });
test("운영 공지에 명시된 점검 보상·티켓·조각을 실제 수량으로 읽고 불명확한 지급은 만들지 않는다", () => {
  const rows = operatorNewsRewards([news(9001, "メンテナンスのお知らせ", "お詫び内容<br>ジュエル150個<br>虹の結晶片1個<br>サポートカードガチャチケット2枚<br>受取期間<br>"),
    news(9002, "イベント紹介", "イベントミッションでジュエル500個！"), news(9003, "メンテナンス", "作業中です。")]);
  assert.equal(rows.length, 1); assert.equal(rows[0].free, 150); assert.equal(rows[0].rainbowShards, 1); assert.equal(rows[0].supportTickets, 2);
});

test("파카라이브 선물 블록과 별도 캠페인 소개를 중복 합산하지 않는다", () => {
  const rows = operatorNewsRewards([news(9004, "ぱかライブ最新情報", "プレゼント内容<br>ジュエル600個<br>SSR確定ガチャチケット ×2<br>配布日時<br>2027年7月1日<br>プレゼント内容<br>ジュエル3000個<br>配布日時<br>2027年7月2日")]);
  assert.equal(rows[0].free, 600);
  assert.equal(Object.values(rows[0].specialTickets ?? {}).reduce((a, b) => a + b, 0), 2);
});

test("같은 날 같은 양인 별도 공지를 보존하고 수정된 같은 공지는 수동 입력보다 우선한다", () => {
  const known = { ...income("gift-legacy", "점검 감사 선물", "gift", 150), reference: "https://umamusume.jp/news/detail?id=9005" };
  const updates = operatorNewsRewards([news(9005, "メンテナンスのお知らせ", "お詫び内容<br>ジュエル300個<br>受取期間"), news(9006, "メンテナンスのお知らせ", "お詫び内容<br>ジュエル150個<br>受取期間")], [known]);
  const rows = catalogIncomes(updates);
  assert.equal(plan({ ...base, incomes: [...rows, known] }).giftFree, 450);
  assert.equal(uniqueIncomes([...rows, known]).length, 2);
});

test("같은 공지에 실린 다른 날짜의 크리스마스 선물은 파카라이브와 구분한다", () => {
  const reference = "https://umamusume.jp/news/detail?id=9007";
  const broadcast = { ...income("gift-broadcast", "ぱかライブTV", "gift", 700), reference };
  const christmas = { ...income("gift-christmas", "크리스마스 기념 선물", "gift", 500), reference, startKr: broadcast.startKr + 5 };
  assert.equal(uniqueIncomes([broadcast, christmas]).length, 2);
});

test("새 주년 3000 선물을 일본 데이터·운영 공지 양쪽에서 읽어도 한 번만 센다", () => {
  const planner = { ...income("anniversary-gift-6", "6th Anniversary Gift", "gift", 3000), category: "anniversary-gift" };
  const official = { ...income("operator-news-9008", "6周年記念ジュエル3000個プレゼント", "gift", 3000), category: "operator-gift", reference: "https://umamusume.jp/news/detail?id=9008" };
  assert.equal(plan({ ...base, incomes: [planner, official] }).giftFree, 3000);
});
