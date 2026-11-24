import "server-only";
import { unstable_cache } from "next/cache";
import { dayFromTimestamp, SERVER_GAP_DAYS } from "./dates";
import { logFailure } from "./fetchJson";
import { load, type GameEvent } from "./gametora";
import type { Income } from "./jewelPlan";
import { giftIncomes, type Scheduled } from "./jewelSources";
import { catalogIncomes, mergeIncomes, type RewardRecord } from "./rewardCatalog";
import { supplementalIncomes } from "./rewardSupplement";
import { hasRewards, itemRewards } from "./rewards";
import snapshot from "./data/rewards.json";
import { fixKo } from "./koName";
import { isEventReward } from "./rewardScope";
import { applySheetRewards, applySheetSchedule } from "./sheetRewards";
import { plannerRewardIncomes, storyScheduleIncomes, characterScheduleIncomes, type StorySchedule } from "./plannerEventSchedule";
import { fetchPlannerModules } from "./plannerSource";
import { operatorNewsRewards, type OperatorNews } from "./operatorNews";
import operatorSnapshot from "./data/operatorRewards.json";
import { futureScenarioRewards } from "./futureCampaignRewards";

const REVALIDATE = 3600;
type Mission = { id: number; itemId: number; itemNumber: number; originalText?: string; startDate?: number; endDate?: number; subMissions?: Mission[] };
type Group = { eventId?: number; eventOriginal?: string; startDate?: number; endDate?: number; missions: Mission[] };
const EXCLUDED = /シンデレラグレイ|Cinderella Gray|신데렐라 그레이/i;

const plannerSchedules = unstable_cache(async (): Promise<Income[]> => {
  try {
    const { app, source } = await fetchPlannerModules();
    return plannerRewardIncomes(app, source);
  } catch (err) { logFailure("일본 이벤트 개최 일정 (기존 일정 사용)", err); return []; }
}, ["sheet-planner-rewards-v2"], { revalidate: REVALIDATE });

const operatorIncomes = unstable_cache(async (): Promise<Income[]> => {
  try {
    const base = "https://umapyoi.net/api/v1/news";
    const json = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw Error(`Operator news ${response.status}`);
      return response.json();
    };
    // Re-read recent notices for amendments, and every newly published ID since the snapshot.
    const [ids, ...pages] = await Promise.all([json<number[]>(base), json<OperatorNews[]>(`${base}/latest/32/0`), json<OperatorNews[]>(`${base}/latest/32/32`)]);
    const news = pages.flat(), seen = new Set(news.map(r => r.announce_id));
    const missing = ids.filter(id => id > operatorSnapshot.lastAnnouncementId && !seen.has(id));
    for (let n = 0; n < missing.length; n += 4) {
      const batch = await Promise.allSettled(missing.slice(n, n + 4).map(id => json<OperatorNews>(`${base}/${id}`)));
      for (const result of batch) if (result.status === "fulfilled") news.push(result.value); else logFailure("개별 운영 공지", result.reason);
    }
    return catalogIncomes(operatorNewsRewards(news, giftIncomes()));
  } catch (err) { logFailure("운영팀 지급 최신 공지 (기존 보상 사용)", err); return []; }
}, ["operator-live-rewards-v1"], { revalidate: REVALIDATE });

const applyRewards = (incomes: Income[]) => futureScenarioRewards(applySheetRewards(incomes));

/** 기간 한정 미션 파일. 팀 스카우트·레이싱 카니발은 이벤트 합계 보상이 따로 있으면 미션을 겹쳐 세지 않는다 */
const MISSION_KEYS = [
  "missions/limited",
  "missions/trainerexam-limited",
  "missions/legendrace-limited",
  "missions/teamscout-limited",
  "missions/racingcarnival-limited",
  "missions/collectraid-limited",
  "missions/story-limited",
];
const AGGREGATE_CATEGORY: Record<string, string> = {
  "missions/teamscout-limited": "team",
  "missions/racingcarnival-limited": "carnival",
};
/** 날짜가 정해지지 않은 자리표시 미션(2030년 이후, 밀리초) */
const MISSION_FAR_FUTURE = 1_900_000_000_000;

/** gametora 미션 파일을 보상 목록으로 펼친다. 하위 미션은 기간이 없으면 상위 기간을 물려받는다 */
function missionIncomes(groups: Group[], key: string, names: Map<number, string | undefined>, baseline: Income[]): Income[] {
  const live: Income[] = [];
  const aggregate = AGGREGATE_CATEGORY[key];
  const visit = (m: Mission, group: Group) => {
    const start = m.startDate ?? group.startDate;
    const end = m.endDate ?? group.endDate;
    if (start && end) {
      const name = group.eventOriginal ?? m.originalText ?? key;
      const startJp = dayFromTimestamp(start / 1000);
      const endJp = dayFromTimestamp(end / 1000);
      const startKr = startJp + SERVER_GAP_DAYS;
      const covered = aggregate && baseline.some((r) => r.category === aggregate && Math.abs(r.startKr - startKr) <= 1);
      const reward = itemRewards([{ id: m.itemId, num: m.itemNumber, name: names.get(m.itemId) }]);
      if (!covered && end < MISSION_FAR_FUTURE && !EXCLUDED.test(name) && hasRewards(reward)) {
        live.push({
          id: `mission-${m.id}`,
          source: "limited",
          category: key,
          name,
          eventGroupId: group.eventId,
          startJp,
          endJp,
          startKr,
          endKr: endJp + SERVER_GAP_DAYS,
          ...reward,
          reference: "https://gametora.com/umamusume/missions",
        });
      }
    }
    for (const sub of m.subMissions ?? []) visit(sub, { ...group, startDate: start, endDate: end });
  };
  for (const group of groups) for (const m of group.missions) visit(m, group);
  return live;
}

/** 외부 데이터 하나가 실패해도 검증된 스냅숏으로 계산은 계속한다 */
export async function getJewelIncomes(): Promise<Income[]> {
  const existing = new Set(snapshot.rows.map((r) => r.id));
  const supplement = supplementalIncomes().filter((r) => !existing.has(r.id));
  const [planner, operator] = await Promise.all([plannerSchedules(), operatorIncomes()]);
  const checkpoint = Math.floor(Date.parse(snapshot.checkedAt.slice(0, 10)) / 86_400_000);
  // 스냅숏보다 오래된, 목록에 없는 미션 ID는 일부러 이벤트 합계에 접어 넣었다
  const fresh = planner.filter((r) => r.category !== "limited" || existing.has(r.id) || (r.startJp ?? r.startKr - SERVER_GAP_DAYS) >= checkpoint);
  let baseline = mergeIncomes(mergeIncomes(mergeIncomes(catalogIncomes(snapshot.rows as RewardRecord[]), supplement), fresh), operator);
  try {
    const items = await load<{ id: number; name_ko?: string; name_jp?: string }[]>("items");
    const names = new Map(items.map((i) => [i.id, i.name_ko ?? i.name_jp]));
    const [results, stories, cards] = await Promise.all([
      Promise.allSettled(MISSION_KEYS.map((key) => load<Group[] | Group>(key))),
      load<StorySchedule[]>("events/story-events").catch((err) => {
        logFailure("스토리 이벤트 일정", err);
        return [] as StorySchedule[];
      }),
      load<Parameters<typeof characterScheduleIncomes>[0]>("character-cards").catch((err) => {
        logFailure("신캐 스토리 일정", err);
        return [];
      }),
    ]);
    const byId = new Map(stories.map((s) => [`story-${s.id}`, s]));
    baseline = baseline.map((r) => {
      const s = byId.get(r.id);
      if (!s) return r;
      const krDates = s.start_ko && s.end_ko ? { startKr: dayFromTimestamp(s.start_ko), endKr: dayFromTimestamp(s.end_ko) } : {};
      return { ...r, name: fixKo(s.name_ko) || s.name_ja || r.name, ...krDates };
    });
    const live = results.flatMap((result, i) => {
      if (result.status === "rejected") {
        logFailure(MISSION_KEYS[i], result.reason);
        return [];
      }
      const groups = Array.isArray(result.value) ? result.value : [result.value];
      return missionIncomes(groups, MISSION_KEYS[i], names, baseline);
    });
    const discovered = [...storyScheduleIncomes(stories), ...characterScheduleIncomes(cards)];
    return applyRewards(mergeIncomes(discovered, mergeIncomes(baseline, live)).filter(isEventReward));
  } catch (err) {
    logFailure("보상 실시간 갱신 (검증된 보상 목록 사용)", err);
    return applyRewards(baseline.filter(isEventReward));
  }
}

const COMPETITION_KINDS = new Set(["cm", "loh", "legend"]);

export function competitionSchedule(events: GameEvent[]): Scheduled[] {
  return applySheetSchedule(
    events.flatMap((e): Scheduled[] =>
      COMPETITION_KINDS.has(e.kind)
        ? [{ kind: e.kind as Scheduled["kind"], id: e.id, name: e.kind === "loh" ? "" : e.name, startKr: e.start, endKr: e.end, raceStartsKr: e.raceStarts }]
        : [],
    ),
  );
}
