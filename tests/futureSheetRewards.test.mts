import assert from "node:assert/strict";
import { test } from "node:test";
import { applySheetRewards, latestSheetRow, SHEET_REWARDS } from "../lib/sheetRewards.ts";
import { plannerEventSchedules, storyScheduleIncomes, characterScheduleIncomes } from "../lib/plannerEventSchedule.ts";
import { competitionIncomes, EMPTY_COMPETITION } from "../lib/jewelSources.ts";
import { plan, type Income, type PlanInput } from "../lib/jewelPlan.ts";
import { SERVER_GAP_DAYS } from "../lib/dates.ts";

const seed = (id: string, category: string, day: number, name = id): Income => ({ id, category, name, source: category === "story" ? "story" : "limited",
  startJp: day, startKr: day + SERVER_GAP_DAYS, endKr: day + SERVER_GAP_DAYS + 10,
  free: 9999, trainTickets: 9, supportTickets: 9, rainbowShards: 9, goldShards: 9 });
const base: PlanInput = { today: 0, target: 1, paid: 0, free: 0, trainTickets: 0, supportTickets: 0, monthly: false, pass: "none", teamClass: 0, incomes: [] };

test("시트 밖 미래 개최마다 최신 종류별 총량을 한 번만 적용하고 반복 갱신에도 유지한다", () => {
  const inputs: Income[] = [];
  for (const kind of ["story", "research", "exam", "masters", "g1", "character-story"] as const) {
    const day = latestSheetRow(kind).startJp + 100;
    inputs.push(seed(`${kind}-9001`, kind, day, kind === "g1" ? "GⅠ new 1" : `${kind}-9001`), seed(`${kind}-9002`, kind, day + 30));
    if (kind === "exam") inputs.push(seed("exam-first-clear-9001", "exam-first-clear", day), seed("mission-220999", "missions/trainerexam-limited", day - 1));
    if (kind === "story") inputs.push(seed("story-mission", "missions/story-limited", day - 1));
    if (kind === "g1") inputs.push(seed("mission-g1-extra", "missions/limited", day, "GⅠ new 1"));
  }
  const output = applySheetRewards(inputs).filter(i => !i.id.startsWith("sheet-"));
  assert.equal(output.length, 12);
  for (const row of output) {
    const template = latestSheetRow(row.category!);
    for (const key of ["free", "trainTickets", "supportTickets", "rainbowShards"] as const) assert.equal(row[key], template[key], `${row.id} ${key}`);
    assert.equal(row.goldShards, 0);
    assert.equal(row.startKr, inputs.find(i => i.id === row.id)!.startKr);
  }
  assert.deepEqual(applySheetRewards(applySheetRewards(inputs)), applySheetRewards(inputs));
});

test("매년 같은 G1 이름과 같은 날의 다른 신캐도 별도 개최로 센다", () => {
  const g1 = latestSheetRow("g1").startJp + 20, character = latestSheetRow("character-story").startJp + 20;
  const inputs = [seed("g1-one", "limited", g1, "春のGⅠ記念ミッション 大阪杯"), seed("g1-two", "limited", g1 + 365, "春のGⅠ記念ミッション 大阪杯"),
    seed("character-story-9001", "character-story", character), seed("character-story-9002", "character-story", character)];
  const output = applySheetRewards(inputs).filter(i => !i.id.startsWith("sheet-"));
  assert.equal(output.length, 4);
  assert.equal(output.filter(i => i.category === "g1").reduce((sum, i) => sum + i.free, 0), 300);
  assert.equal(output.filter(i => i.category === "character-story").reduce((sum, i) => sum + i.free, 0), 160);
});

test("미래 레전드는 선택 시 500주얼·무지개 1개이며 기존 상대별·참가 미션과 중복하지 않는다", () => {
  const day = latestSheetRow("legend").startJp + 40, startKr = day + SERVER_GAP_DAYS;
  const schedule = [{ id: "legend-new", kind: "legend" as const, name: "미래 레전드", startKr, endKr: startKr + 6, raceStartsKr: [startKr, startKr + 3] }];
  const original = seed("legend-new-mission", "missions/legendrace-limited", day, "レジェンドレースに12回出走しよう");
  const incomes = applySheetRewards([original]);
  const selected = competitionIncomes(schedule, { ...EMPTY_COMPETITION, legendRace: true });
  const p = plan({ ...base, today: startKr - 1, target: startKr + 10, incomes: [...incomes, ...selected] });
  assert.equal(p.competitionFree, 500); assert.equal(p.earnedMaterials.rainbowShards, 1);
  assert.ok(!p.incomes.some(i => i.id === original.id));
  assert.equal(competitionIncomes(schedule, EMPTY_COMPETITION).length, 0);
});

test("미래 챔미·말오스도 기존 순위 선택으로 시트 표를 사용한다", () => {
  for (const kind of ["cm", "loh"] as const) {
    const startKr = latestSheetRow(kind).startJp + SERVER_GAP_DAYS + 100;
    const rewards = competitionIncomes([{ id: `${kind}-new`, kind, name: "새 대회", startKr, endKr: startKr + 5 }], { ...EMPTY_COMPETITION, cmResult: "A2", lohRank: 14 });
    assert.equal(rewards.length, 1); assert.equal(rewards[0].free, kind === "cm" ? 2400 : 3250);
    assert.equal(rewards[0].startKr, startKr + 5);
  }
});

test("미래 개최 근처의 점검·파카라이브·로그인·다른 이벤트는 보상 종류를 바꾸지 않는다", () => {
  const day = latestSheetRow("research").startJp + 40;
  const unrelated = [ { ...seed("broadcast", "operator-gift", day, "인자연구 기념 파카라이브"), source: "gift" as const },
    { ...seed("login", "login", day, "G1 기념 로그인"), source: "login" as const }, seed("carnival-new", "carnival", day) ];
  const output = applySheetRewards([...unrelated, seed("research-9001", "research", day)]);
  for (const row of unrelated) assert.deepEqual(output.find(i => i.id === row.id), row);
  assert.equal(output.find(i => i.id === "research-9001")!.free, 1200);
});

test("새 스토리 일정과 신캐 최초 출시일만 있어도 보상을 생성하고 의상은 재합산하지 않는다", () => {
  const day = Math.max(latestSheetRow("story").startJp, latestSheetRow("character-story").startJp) + 100;
  const iso = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
  const stories = storyScheduleIncomes([{ id: 9001, name_ja: "새 스토리", start_ja: day * 86400, end_ja: (day + 10) * 86400, start_ko: (day + 300) * 86400 }]);
  const characters = characterScheduleIncomes([{ char_id: 9991, release: iso(day) }, { char_id: 9991, release: iso(day + 40) },
    { char_id: 1001, release: "2021-02-24" }, { char_id: 1001, release: iso(day) }]);
  assert.equal(characters.length, 1);
  const output = applySheetRewards([...stories, ...characters]);
  assert.equal(output.find(i => i.id === "story-9001")!.free, 2910);
  assert.equal(output.find(i => i.id === "story-9001")!.startKr, day + 300);
  assert.equal(output.find(i => i.id === "character-story-9991")!.free, 80);
});

test("신캐 스토리는 한국서버 출시일이 있으면 그 날짜를, 없으면 일본 날짜 + 476일을 쓴다", () => {
  const day = latestSheetRow("character-story").startJp + 100;
  const iso = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
  const [confirmed, estimated] = characterScheduleIncomes([
    { char_id: 9991, release: iso(day), release_ko: iso(day + 400) },
    { char_id: 9992, release: iso(day) },
  ]);
  assert.equal(confirmed.startKr, day + 400);
  assert.equal(confirmed.startJp, day);
  assert.equal(estimated.startKr, day + 476);
  const output = applySheetRewards([confirmed]);
  assert.equal(output.find(i => i.id === "character-story-9991")!.free, 80);
  assert.equal(output.find(i => i.id === "character-story-9991")!.startKr, day + 400);
});

test("공개 플래너의 데이터 리터럴에서 일본 개최 일정만 읽고 원본 보상량·실행 코드는 쓰지 않는다", () => {
  const day = Math.max(...SHEET_REWARDS.rows.map(r => r.startJp)) + 100;
  const event = { id: 9001, title: "new", start_date: day * 86400, end_date: (day + 10) * 86400, reward_quantity1: 99999 };
  const app = 'import{a as R,b as E,c as M}from"./chunks/uma-data.fixture.js";f("Spark Laboratory",R);f("Trainer Aptitude Tests",E);f("Masters Challenges",M);';
  const source = `const r=JSON.parse(${JSON.stringify(JSON.stringify([event]))}),e=[{id:9002,title:"new",start_date:${event.start_date},end_date:${event.end_date},"":""}],m=${JSON.stringify([event])};export{r as a,e as b,m as c};`;
  const schedules = plannerEventSchedules(app, source);
  assert.equal(schedules.length, 3);
  assert.ok(schedules.every(i => i.free === 0));
  const applied = applySheetRewards(schedules);
  assert.equal(applied.find(i => i.id === "masters-9001")!.free, 4500);
  assert.throws(() => plannerEventSchedules(app, source.replace(`m=${JSON.stringify([event])}`, 'm=[(()=>{throw Error("must not run")})()]')), /Expression is not data/);
});
