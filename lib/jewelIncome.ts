// 사료계산기에 넣는 기간 한정 보상과 대회 일정을 gametora에서 모은다.
// 스토리 이벤트와 대회는 한국서버 일정이 있고, 기간 한정 미션·트레이너 시험은 일본 데이터뿐이라 +476일로 잡는다.
import "server-only";
import { dayFromTimestamp, SERVER_GAP_DAYS } from "./dates";
import { fetchJson, logFailure } from "./fetchJson";
import type { GameEvent } from "./gametora";
import type { Income } from "./jewelPlan";
import type { Scheduled } from "./jewelSources";
import { fixKo } from "./koName";

const BASE = "https://gametora.com/data";
const REVALIDATE = 3600;

// 아이템 ID: 43 쥬얼(무료), 41 육성 뽑기 티켓, 111 서포트 카드 뽑기 티켓
const ITEM_JEWEL = 43;
const ITEM_TRAIN_TICKET = 41;
const ITEM_SUPPORT_TICKET = 111;
// 신데렐라 그레이 방영 기념 캠페인은 한일 동시 진행이라 계산에서 뺀다
const EXCLUDED_EVENT = /シンデレラグレイ|Cinderella Gray|신데렐라 그레이/i;

type RawLimitedMissions = {
  eventId: number;
  eventOriginal: string;
  eventEn?: string;
  /** 밀리초, 일본서버 */
  startDate: number;
  endDate: number;
  missions: { itemId: number; itemNumber: number }[];
};
type RawStoryEvent = { id: number; name_ja?: string; name_ko?: string; start_ko?: number; end_ko?: number };
type RawStoryRewards = { id: number; rewards: { item_id: number; item_num: number }[] };
/** 빙고 시트마다 줄 보상에 쥬얼이 있다. 다시 도는 시트도 한 번만 센다 */
type RawStoryBingo = { id: number; bingo: { line_rewards: { item_id: number; item_num: number }[] }[] };
type RawExamMissions = {
  missions: { itemId: number; itemNumber: number; startDate: number; endDate: number; subMissions?: { itemId: number; itemNumber: number }[] }[];
};

function rewardTotals(items: { id: number; num: number }[]) {
  const total = (id: number) => items.filter((i) => i.id === id).reduce((a, i) => a + i.num, 0);
  return { free: total(ITEM_JEWEL), trainTickets: total(ITEM_TRAIN_TICKET), supportTickets: total(ITEM_SUPPORT_TICKET) };
}

const jpMsToKr = (ms: number) => dayFromTimestamp(ms / 1000) + SERVER_GAP_DAYS;

async function getJson<T>(key: string): Promise<T> {
  const m = await fetchJson<Record<string, string>>(`${BASE}/manifests/umamusume.json`, REVALIDATE);
  return fetchJson<T>(`${BASE}/umamusume/${key}.${m[key]}.json`, REVALIDATE);
}

/** 기간 한정 미션, 트레이너 시험, 스토리 이벤트 포인트·빙고 보상 중 쥬얼이나 티켓을 주는 것 */
export async function getJewelIncomes(): Promise<Income[]> {
  try {
    const [limited, stories, rewards, bingos, exams] = await Promise.all([
      getJson<RawLimitedMissions[]>("missions/limited"),
      getJson<RawStoryEvent[]>("events/story-events"),
      getJson<RawStoryRewards[]>("events/story-events-rewards"),
      getJson<RawStoryBingo[]>("events/story-events-bingo"),
      getJson<RawExamMissions | RawExamMissions[]>("missions/trainerexam-limited"),
    ]);
    const incomes: Income[] = [];

    const examByPeriod = new Map<string, { start: number; end: number; items: { id: number; num: number }[] }>();
    for (const m of (Array.isArray(exams) ? exams : [exams]).flatMap((e) => e.missions)) {
      const key = `${m.startDate}-${m.endDate}`;
      const g = examByPeriod.get(key) ?? { start: m.startDate, end: m.endDate, items: [] };
      for (const x of [m, ...(m.subMissions ?? [])]) g.items.push({ id: x.itemId, num: x.itemNumber });
      examByPeriod.set(key, g);
    }
    for (const g of examByPeriod.values()) {
      const t = rewardTotals(g.items);
      if (t.free + t.trainTickets + t.supportTickets === 0) continue;
      incomes.push({ id: `exam-${g.start}`, source: "limited", name: "트레이너 시험 기간 한정 미션", startKr: jpMsToKr(g.start), endKr: jpMsToKr(g.end), ...t });
    }

    for (const e of limited) {
      if (EXCLUDED_EVENT.test(`${e.eventOriginal} ${e.eventEn ?? ""}`)) continue;
      const t = rewardTotals(e.missions.map((m) => ({ id: m.itemId, num: m.itemNumber })));
      if (t.free + t.trainTickets + t.supportTickets === 0) continue;
      incomes.push({ id: `limited-${e.eventId}`, source: "limited", name: e.eventOriginal, startKr: jpMsToKr(e.startDate), endKr: jpMsToKr(e.endDate), ...t });
    }

    const rewardMap = new Map(rewards.map((r) => [r.id, r.rewards]));
    const bingoMap = new Map(bingos.map((b) => [b.id, b.bingo.flatMap((sheet) => sheet.line_rewards)]));
    for (const s of stories) {
      if (!s.start_ko || !s.end_ko) continue;
      const name = fixKo(s.name_ko) || s.name_ja || `스토리 이벤트 ${s.id}`;
      if (EXCLUDED_EVENT.test(name)) continue;
      const t = rewardTotals([...(rewardMap.get(s.id) ?? []), ...(bingoMap.get(s.id) ?? [])].map((r) => ({ id: r.item_id, num: r.item_num })));
      if (t.free + t.trainTickets + t.supportTickets === 0) continue;
      incomes.push({ id: `story-${s.id}`, source: "story", name, startKr: dayFromTimestamp(s.start_ko), endKr: dayFromTimestamp(s.end_ko), ...t });
    }
    return incomes.sort((a, b) => a.startKr - b.startKr);
  } catch (err) {
    logFailure("gametora 기간 한정 보상", err);
    return [];
  }
}

/** 한국서버 대회 일정을 계산기의 대회 보상 일정으로 */
export function competitionSchedule(events: GameEvent[]): Scheduled[] {
  return events.flatMap((e): Scheduled[] => {
    if (e.kind === "story") return [];
    return [{ kind: e.kind, id: e.id, name: e.kind === "loh" ? "" : e.name, startKr: e.start, endKr: e.end, raceStartsKr: e.raceStarts }];
  });
}
