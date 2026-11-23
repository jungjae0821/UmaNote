import "server-only";
import { unstable_cache } from "next/cache";
import { dayFromTimestamp, SERVER_GAP_DAYS } from "./dates";
import { fetchJson, logFailure } from "./fetchJson";
import type { GameEvent } from "./gametora";
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

const BASE = "https://gametora.com/data";
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

/** Verified snapshot remains available when an individual external dataset fails. */
export async function getJewelIncomes(): Promise<Income[]> {
  const existing=new Set(snapshot.rows.map(r=>r.id));
  const supplement=supplementalIncomes().filter(r=>!existing.has(r.id));
  const [planner, operator] = await Promise.all([plannerSchedules(), operatorIncomes()]);
  const checkpoint = Math.floor(Date.parse(snapshot.checkedAt.slice(0, 10)) / 86400000);
  // Older missing mission IDs were intentionally folded into catalog event totals.
  const fresh = planner.filter(r => r.category !== "limited" || existing.has(r.id) || (r.startJp ?? r.startKr - SERVER_GAP_DAYS) >= checkpoint);
  let baseline = mergeIncomes(mergeIncomes(mergeIncomes(catalogIncomes(snapshot.rows as RewardRecord[]), supplement), fresh), operator);
  try {
    const manifest = await fetchJson<Record<string,string>>(`${BASE}/manifests/umamusume.json`,REVALIDATE);
    const names = new Map((await fetchJson<{id:number;name_ko?:string;name_jp?:string}[]>(`${BASE}/umamusume/items.${manifest.items}.json`,REVALIDATE)).map(i=>[i.id,i.name_ko??i.name_jp]));
    const keys = ["missions/limited","missions/trainerexam-limited","missions/legendrace-limited","missions/teamscout-limited","missions/racingcarnival-limited","missions/collectraid-limited","missions/story-limited"];
    const [results,stories,cards] = await Promise.all([
      Promise.allSettled(keys.map(key=>fetchJson<Group[] | Group>(`${BASE}/umamusume/${key}.${manifest[key]}.json`,REVALIDATE))),
      fetchJson<StorySchedule[]>(`${BASE}/umamusume/events/story-events.${manifest["events/story-events"]}.json`,REVALIDATE).catch(err=>{logFailure("스토리 이벤트 일정",err);return [] as StorySchedule[];}),
      fetchJson<Parameters<typeof characterScheduleIncomes>[0]>(`${BASE}/umamusume/character-cards.${manifest["character-cards"]}.json`,REVALIDATE).catch(err=>{logFailure("신캐 스토리 일정",err);return [];}),
    ]);
    const byId=new Map(stories.map(s=>[`story-${s.id}`,s]));
    baseline=baseline.map(r=>{
      const s=byId.get(r.id);
      return s?{...r,name:fixKo(s.name_ko)||s.name_ja||r.name,...(s.start_ko&&s.end_ko?{startKr:dayFromTimestamp(s.start_ko),endKr:dayFromTimestamp(s.end_ko)}:{})}:r;
    });
    const live: Income[] = [];
    const visit = (m: Mission, group: Group, key: string) => {
      const start = m.startDate ?? group.startDate, end = m.endDate ?? group.endDate;
      if (start && end) {
        const name = group.eventOriginal ?? m.originalText ?? key;
        const startKr = dayFromTimestamp(start / 1000) + SERVER_GAP_DAYS;
        const aggregate = key === "missions/teamscout-limited" ? "team" : key === "missions/racingcarnival-limited" ? "carnival" : null;
        const covered = aggregate && baseline.some(r=>r.category===aggregate && Math.abs(r.startKr-startKr)<=1);
        const reward = itemRewards([{id:m.itemId,num:m.itemNumber,name:names.get(m.itemId)}]);
        if (!covered && end<1_900_000_000_000 && !EXCLUDED.test(name) && hasRewards(reward)) live.push({id:`mission-${m.id}`,source:"limited",category:key,name,eventGroupId:group.eventId,startJp:dayFromTimestamp(start/1000),endJp:dayFromTimestamp(end/1000),startKr,endKr:dayFromTimestamp(end/1000)+SERVER_GAP_DAYS,...reward,reference:"https://gametora.com/umamusume/missions"});
      }
      for (const sub of m.subMissions ?? []) visit(sub,{...group,startDate:start,endDate:end},key);
    };
    results.forEach((result,i)=>{
      if(result.status==="fulfilled") for(const group of Array.isArray(result.value) ? result.value : [result.value]) for(const m of group.missions) visit(m,group,keys[i]);
      else logFailure(keys[i],result.reason);
    });
    const discovered = [...storyScheduleIncomes(stories), ...characterScheduleIncomes(cards)];
    return applyRewards(mergeIncomes(discovered,mergeIncomes(baseline,live)).filter(isEventReward));
  } catch(err) {
    logFailure("보상 실시간 갱신 (검증된 보상 목록 사용)",err);
    return applyRewards(baseline.filter(isEventReward));
  }
}

export function competitionSchedule(events: GameEvent[]): Scheduled[] {
  return applySheetSchedule(events.flatMap((e): Scheduled[] => e.kind !== "cm" && e.kind !== "loh" && e.kind !== "legend" ? [] : [{kind:e.kind,id:e.id,name:e.kind==="loh"?"":e.name,startKr:e.start,endKr:e.end,raceStartsKr:e.raceStarts}]));
}
