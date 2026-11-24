import data from "./data/sheetRewards.json" with { type: "json" };
import type { Income } from "./jewelPlan.ts";
import type { CompetitionInput, Scheduled } from "./jewelSources.ts";
import { sheetMissingMaterials, type Rewards } from "./rewards.ts";
import { SERVER_GAP_DAYS } from "./dates.ts";
import { applyAdditionalSheetRewards } from "./additionalSheetRewards.ts";

/** The user's workbook is authoritative for the rows it contains. */
export const SHEET_REWARDS = data;
type SheetRow = (typeof data.rows)[number];
const competition = (r: SheetRow) => r.category === "cm" || r.category === "loh" || r.category === "legend";
const near = (day: number, row: SheetRow, tolerance = 2) => Math.abs(day - row.startJp) <= tolerance;
const jpDay = (i: Income) => i.startJp ?? i.startKr - SERVER_GAP_DAYS;
const normalize = (s: string) => s.replace(/\s|[「」・]/g, "")
  .replace("뒤랑달", "듀랜달").replace("윈바리아시옹", "원바리아시옹").replace("푸리오소", "푸리오스");
const characterName = (r: SheetRow) => normalize(r.name.split(" - ")[1]);
type TemplateKind = "story" | "research" | "exam" | "masters" | "g1" | "character-story";
export function latestSheetRow(category: string): SheetRow {
  return data.rows.filter(r => r.category === category).reduce((a, b) => a.startJp > b.startJp ? a : b);
}

function templateKind(i: Income): TemplateKind | undefined {
  const category = i.category ?? i.source;
  // Operator gifts and logins may mention an event but are separate income.
  if (i.source === "gift" || i.source === "login") return;
  if (["story", "research", "masters", "character-story", "g1"].includes(category)) return category as TemplateKind;
  if (category === "exam" || category === "exam-first-clear" || category === "missions/trainerexam-limited" || /^mission-220/.test(i.id)) return "exam";
  if (category === "missions/story-limited") return "story";
  if (category === "limited" || category === "missions/limited") {
    if (/G[Ⅰ1１]/.test(i.name)) return "g1";
    if (/試験評価|技能試験|기능\s*시험/.test(i.name)) return "exam";
    if (/因子研究|인자\s*연구/.test(i.name)) return "research";
    if (/マスターズチャレンジ|마스터즈\s*챌린지/.test(i.name)) return "masters";
  }
}

/** A known future edition gets one latest-sheet total, never total + components. */
export function applyFutureSheetRewards(incomes: Income[]): Income[] {
  const untouched: Income[] = [];
  const groups: { kind: TemplateKind; rows: Income[]; day: number; key?: string }[] = [];
  for (const i of new Map(incomes.map(i => [i.id, i])).values()) {
    const kind = templateKind(i), day = jpDay(i);
    const legendMission = /レジェンドレース|레전드 레이스|legendrace/.test(`${i.category ?? ""} ${i.name}`);
    if (i.source !== "gift" && i.source !== "login" && legendMission && day > latestSheetRow("legend").startJp) continue;
    if (!kind || day <= latestSheetRow(kind).startJp || data.rows.some(r => r.id === i.id)) { untouched.push(i); continue; }
    const edition = i.id.match(/^(story|research|exam|masters)-(?:first-clear-)?(\d+)$/);
    const key = kind === "character-story" ? i.id : kind === "g1" ? normalize(i.name) : edition?.[2];
    const group = groups.find(g => g.kind === kind && (kind !== "g1" || Math.abs(g.day - day) <= 2) && (key && g.key ? key === g.key : Math.abs(g.day - day) <= 2));
    if (group) { group.rows.push(i); group.key ??= key; }
    else groups.push({ kind, rows: [i], day, key });
  }
  return [...untouched, ...groups.map(({ kind, rows }) => {
    const template = latestSheetRow(kind);
    const anchor = rows.find(i => i.id.match(new RegExp(`^${kind}-\\d+$`))) ?? rows[0];
    // 시트에 없는 금 결정 조각·해방 결정은 같은 최신 시트 행이 이어받은 값을 쓴다
    const latest = incomes.find(i => i.id === template.id);
    return { ...anchor, category: kind,
      free: template.free, trainTickets: template.trainTickets, supportTickets: template.supportTickets,
      rainbowShards: template.rainbowShards, ...sheetMissingMaterials(latest ? [latest] : []), specialTickets: {},
      reference: `${data.reference}?range=${encodeURIComponent(`'${template.sheet}'!D${template.row}:G${template.row}`)}`,
      condition: "개최 일정에 시트의 같은 종류 최신 보상 적용; 이벤트 보상 전부 획득",
    };
  })].sort((a, b) => a.startKr - b.startKr || a.id.localeCompare(b.id));
}

/** Replace whole event totals, including their separately collected missions. */
export function applySheetRewards(incomes: Income[]): Income[] {
  const ordinary = data.rows.filter(r => !competition(r));
  const g1 = ordinary.filter(r => r.category === "g1");
  const g1Min = Math.min(...g1.map(r => r.startJp));
  const g1Max = Math.max(...g1.map(r => r.startJp));
  /** 이 보상을 대신하는 시트 행들. 비어 있으면 시트에 없는 보상 */
  const coveringRows = (i: Income): SheetRow[] => {
    const category = i.category ?? i.source, day = jpDay(i);
    if (i.id.startsWith("sheet-")) return data.rows.filter(r => r.id === i.id);
    if (/G[Ⅰ1１]/.test(i.name) && (category === "limited" || category === "missions/limited") && day >= g1Min - 10 && day <= g1Max) return g1;
    // Legend's one rainbow shard is already in the workbook's edition total.
    if (/レジェンドレース|레전드 레이스|legendrace/.test(`${i.name} ${category}`))
      return data.rows.filter(r => r.category === "legend" && near(day, r, 7));
    return ordinary.filter(r => {
      if (r.category === "story") return i.id === `story-${1000 + r.edition!}` || (category === "missions/story-limited" && near(day, r));
      if (r.category === "research") return i.id === `research-${r.edition}` || (category === "research" && near(day, r));
      if (r.category === "exam") return i.id === `exam-${r.edition}` || i.id === `exam-first-clear-${r.edition}` || (/exam|技能試験|試験評価|기능시험/.test(`${category} ${i.name}`) && near(day, r));
      if (r.category === "masters") return i.id === `masters-${r.edition}`;
      if (r.category === "character-story") return category === "character-story" && near(day, r) && normalize(i.name).includes(characterName(r));
      return false;
    });
  };
  // 시트에 없는 금 결정 조각·해방 결정은 시트 행이 대신하는 원래 보상에서 이어받는다 (여러 행이면 날짜가 가장 가까운 행)
  const replaced = new Map<string, Map<string, Income>>();
  const kept: Income[] = [];
  for (const i of incomes) {
    const rows = coveringRows(i);
    if (!rows.length) { kept.push(i); continue; }
    const row = rows.reduce((a, b) => Math.abs(jpDay(i) - a.startJp) <= Math.abs(jpDay(i) - b.startJp) ? a : b);
    if (!replaced.has(row.id)) replaced.set(row.id, new Map());
    replaced.get(row.id)!.set(i.id, i);
  }
  const imported: Income[] = ordinary.map(r => ({
    id: r.id, source: r.category === "story" ? "story" : "limited", category: r.category,
    name: r.name, startKr: r.startKr, endKr: r.startKr,
    free: r.free, trainTickets: r.trainTickets, supportTickets: r.supportTickets, rainbowShards: r.rainbowShards,
    ...sheetMissingMaterials([...(replaced.get(r.id)?.values() ?? [])]),
    reference: `${data.reference}?range=${encodeURIComponent(`'${r.sheet}'!A${r.row}:G${r.row}`)}`,
    condition: r.category === "character-story" ? "스토리 1~4화 최초 열람" : "시트에 기재된 이벤트 보상 전부 획득",
  }));
  return applyAdditionalSheetRewards(applyFutureSheetRewards([...kept, ...imported]));
}

/** Preserve existing selections; workbook formulas refer to these PVP tables. */
export function sheetCmReward(league: CompetitionInput["cmLeague"], result: CompetitionInput["cmResult"], table: "before" | "after"): Rewards {
  const rank = ["A1", "A2", "A3", "B1", "B2", "B3"].indexOf(result);
  return rank < 0 ? { free: 0, trainTickets: 0, supportTickets: 0 } : data.cm[table][rank + (league === "open" ? 6 : 0)];
}

export function sheetLohReward(rank: number, table: "before" | "after") {
  return rank >= 12 && rank <= 15 ? data.loh[table][15 - rank] : undefined;
}

/** Supply sheet editions missing from the feed and replace matching feed entries. */
export function applySheetSchedule(schedule: Scheduled[]): Scheduled[] {
  const remaining = [...schedule];
  const imported = data.rows.filter(competition).map(r => {
    // 시트 날짜는 보상일이라 챔미처럼 종료일에 받는 대회는 종료일과 맞는다. 시작·종료 중 가까운 쪽으로 비교한다
    const candidates = remaining.map((s, index) => ({ s, index, delta: Math.min(Math.abs(s.startKr - SERVER_GAP_DAYS - r.startJp), Math.abs(s.endKr - SERVER_GAP_DAYS - r.startJp)) }))
      .filter(x => x.s.kind === r.category && x.delta <= 18).sort((a, b) => a.delta - b.delta);
    const match = candidates[0];
    if (match) remaining.splice(match.index, 1);
    return { id: match?.s.id ?? r.id, kind: r.category as Scheduled["kind"], name: r.name,
      startKr: r.startKr, endKr: r.startKr, sheetRewardId: r.id };
  });
  return [...remaining, ...imported].sort((a, b) => a.startKr - b.startKr);
}

export function sheetCompetitionIncome(s: Scheduled, c: CompetitionInput): Income[] | undefined {
  const r = s.sheetRewardId ? data.rows.find(r => r.id === s.sheetRewardId) :
    s.startKr - SERVER_GAP_DAYS > latestSheetRow(s.kind).startJp ? latestSheetRow(s.kind) : undefined;
  if (!r) return undefined;
  if (s.kind === "legend" && !c.legendRace) return [];
  const reward = s.kind === "cm" ? sheetCmReward(c.cmLeague, c.cmResult, r.table as "before" | "after")
    : s.kind === "loh" ? sheetLohReward(c.lohRank, r.table as "before" | "after") : r;
  // Lower LOH ranks are absent from this workbook; retain the existing rank table.
  if (!reward) return undefined;
  if (!reward.free) return [];
  return [{ id: s.id, source: s.kind, name: s.sheetRewardId ? r.name : s.name || r.name, startKr: s.sheetRewardId || s.kind === "legend" ? s.startKr : s.endKr, endKr: s.endKr,
    free: reward.free, trainTickets: reward.trainTickets, supportTickets: reward.supportTickets,
    rainbowShards: reward.rainbowShards ?? 0, goldShards: s.kind === "legend" ? LEGEND_GOLD_SHARDS : s.kind === "loh" ? LOH_GOLD_SHARDS : 0,
    reference: data.reference }];
}

// 시트에는 무지개 조각 열만 있어서 금 결정 조각을 따로 더한다.
// 레전드 레이스: 기간 한정 6회·9회 출주 미션에서 1개씩 (이 미션은 시트 개최 보상에 묶여 목록에서 빠진다)
const LEGEND_GOLD_SHARDS = 2;
// 리그 오브 히어로즈: 시트 표는 플래티넘 1 이상만 있고, 골드 3·골드 4 달성 보상으로 1개씩
const LOH_GOLD_SHARDS = 2;
