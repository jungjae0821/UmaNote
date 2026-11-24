import data from "./data/sheetRewards.json" with { type: "json" };
import type { Income } from "./jewelPlan.ts";
import { SERVER_GAP_DAYS } from "./dates.ts";
import { sheetMissingMaterials } from "./rewards.ts";

const scores = data.additionalRows.filter(r => r.role === "scenario-score").sort((a, b) => b.startJp - a.startJp);
const score = scores[0];
const mission = data.additionalRows.filter(r => r.role === "mission" && !/Anniversary/.test(r.name)).sort((a, b) => b.startJp - a.startJp)[0];
const jp = (i: Income) => i.startJp ?? i.startKr - SERVER_GAP_DAYS;

/** A published new-scenario launch supplies a date, never an invented recurrence. */
export function futureScenarioRewards(incomes: Income[]): Income[] {
  const launches: { day: number; anchor: Income; title?: string }[] = [];
  for (const i of incomes) {
    if (i.source === "gift" || jp(i) <= score.startJp || i.category === "sheet-extra") continue;
    if (i.source === "login" && (i.loginDay ?? Number(i.id.match(/^login-\d+-(\d+)$/)?.[1] ?? i.name.match(/\((\d+)일차\)/)?.[1] ?? 1)) !== 1) continue;
    if (!/新育成シナリオ.*(?:公開|記念)/.test(i.name)) continue;
    const day = jp(i);
    const existing = launches.find(l => Math.abs(l.day - day) <= 1);
    const title = i.name.match(/「([^」]+)」/)?.[1];
    if (existing) { existing.title ??= title; if (i.source === "login") existing.anchor = i; }
    else launches.push({ day, anchor: i, title });
  }
  const removed = new Set<string>(), added: Income[] = [];
  // 시트에 없는 금 결정 조각·해방 결정은 최신 시나리오 시트 행이 이어받은 값을 쓴다
  const carried = (id: string) => sheetMissingMaterials(incomes.filter(i => i.id === id).slice(0, 1));
  for (const launch of launches) {
    const matching = incomes.filter(i => i.source === "limited" && Math.abs(jp(i) - launch.day) <= 1 &&
      (/新育成シナリオ.*(?:公開|記念)/.test(i.name) || (launch.title && i.name.includes(launch.title))));
    const ids = new Set(matching.map(i => i.eventGroupId).filter(id => id !== undefined));
    for (const i of incomes) if (matching.includes(i) || (i.source === "limited" && i.eventGroupId !== undefined && ids.has(i.eventGroupId) && Math.abs(jp(i) - launch.day) <= 1) || i.id === `scenario-score-${launch.day}` || i.id === `scenario-mission-${launch.day}`) removed.add(i.id);
    for (const [kind, template] of [["mission", mission], ["score", score]] as const) added.push({
      id: `scenario-${kind}-${launch.day}`, source: "limited", category: `scenario-${kind}`, name: `신규 시나리오 ${launch.title ?? "공개"} ${kind === "score" ? "평가점 보상" : "기념 미션"}`,
      startJp: launch.day, startKr: launch.anchor.startKr, endKr: launch.anchor.endKr,
      free: template.free, trainTickets: template.trainTickets, supportTickets: template.supportTickets, rainbowShards: template.rainbowShards,
      ...carried(template.id),
      reference: data.reference, condition: "일본 공개 일정에 시트의 최신 시나리오 보상 적용; 평가점·미션 전부 달성",
    });
  }
  return [...incomes.filter(i => !removed.has(i.id)), ...added].sort((a, b) => a.startKr - b.startKr || a.id.localeCompare(b.id));
}
