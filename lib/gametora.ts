import { fetchJson, logFailure } from "./fetchJson";
import { fixKo } from "./koNameFallback";
import { dayFromTimestamp, jpToKr } from "./dates";
import type { Income } from "./jewelPlan";
import { lohStartsKr, type Scheduled } from "./jewelSources";

// gametora의 카드 데이터에서 한국어 이름·카드 제목을 가져온다.
// 파일 이름에 해시가 붙어 있어서 manifest로 현재 파일을 찾는다.
const BASE = "https://gametora.com/data";
const REVALIDATE = 86_400;
const getJson = <T>(url: string) => fetchJson<T>(url, REVALIDATE);

type Manifest = Record<string, string>;

type RawCharacterCard = {
  card_id: number;
  char_id: number;
  rarity: number;
  name_ko?: string;
  title_ko?: string;
  name_jp?: string;
  title_jp?: string;
};
type RawSupportCard = {
  support_id: number;
  char_id: number;
  /** 1: R, 2: SR, 3: SSR */
  rarity: number;
  name_ko?: string;
  title_ko?: string;
  name_jp?: string;
  title_ja?: string;
};

export type KoText = { name?: string; title?: string };

export type KoLookup = {
  /** 육성 의상 ID → 한국어 */
  outfit: Map<number, KoText>;
  /** 서포트 카드 ID → 한국어 */
  support: Map<number, KoText>;
  /** 캐릭터 ID → 한국어 이름 (카드에 이름이 빠져 있을 때 대신 씀) */
  chara: Map<number, string>;
  /** 육성 의상 ID → 캐릭터 ID·초기 레어도·일본어 원문 (umapyoi에 없는 카드를 그릴 때 씀) */
  outfitCard: Map<number, { charaId: number; rarity: number; nameJp?: string; titleJp?: string }>;
  /** 서포트 카드 ID → 캐릭터 ID·레어도·일본어 원문 */
  supportCard: Map<number, { charaId: number; rarity: number; nameJp?: string; titleJp?: string }>;
};

/** 실패하면 빈 표를 돌려준다. 이름은 일본어 원문으로 표시된다 */
export async function getKoLookup(): Promise<KoLookup> {
  const lookup: KoLookup = {
    outfit: new Map(),
    support: new Map(),
    chara: new Map(),
    outfitCard: new Map(),
    supportCard: new Map(),
  };
  try {
    const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
    const [cards, supports] = await Promise.all([
      getJson<RawCharacterCard[]>(`${BASE}/umamusume/character-cards.${manifest["character-cards"]}.json`),
      getJson<RawSupportCard[]>(`${BASE}/umamusume/support-cards.${manifest["support-cards"]}.json`),
    ]);
    for (const raw of cards) {
      const c = { ...raw, name_ko: fixKo(raw.name_ko), title_ko: fixKo(raw.title_ko) };
      lookup.outfit.set(c.card_id, { name: c.name_ko, title: c.title_ko });
      lookup.outfitCard.set(c.card_id, { charaId: c.char_id, rarity: c.rarity, nameJp: c.name_jp, titleJp: c.title_jp });
      if (c.name_ko) lookup.chara.set(c.char_id, c.name_ko);
    }
    for (const raw of supports) {
      const s = { ...raw, name_ko: fixKo(raw.name_ko), title_ko: fixKo(raw.title_ko) };
      lookup.support.set(s.support_id, { name: s.name_ko, title: s.title_ko });
      lookup.supportCard.set(s.support_id, { charaId: s.char_id, rarity: s.rarity, nameJp: s.name_jp, titleJp: s.title_ja });
      if (s.name_ko && !lookup.chara.has(s.char_id)) lookup.chara.set(s.char_id, s.name_ko);
    }
  } catch (err) {
    // 한국어가 없어도 화면은 일본어로 그대로 동작한다
    logFailure("gametora 카드 한국어 이름", err);
  }
  return lookup;
}

// 육성 가챠 배너의 카드별 제공 비율. lineup 키는 카드 하나의 확률을 0.0001% 단위로 적은 값이다(7500 = 0.75%).
// pickups는 [카드 ID, 비율, 신규 여부]
type RawCharBanner = { id: number; lineup: Record<string, number[]>; pickups?: [number, number, boolean][] };

/** 정규 픽업 배너. 서포트 배너도 모양이 같다. start·end는 일본서버 유닉스 타임스탬프(초) */
export type RawBanner = RawCharBanner & { start: number; end: number };

/** 육성·서포트 정규 픽업 배너 전체 (gametora 시뮬레이터와 같은 범위) */
export async function getStandardBanners(kind: "char" | "support"): Promise<RawBanner[]> {
  const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
  const key = `gacha/${kind}-standard`;
  return getJson<RawBanner[]>(`${BASE}/umamusume/${key}.${manifest[key]}.json`);
}

// ★3 기본 풀 없이 정해진 ★3만 나오는 배너를 찾는다. 이런 배너는 ★3 전원이 0.1% 이상을 받는다
// (예: 9명 × 0.333%). 서비스 초기 배너도 ★3이 적어 모두 0.1%를 넘지만 신규 픽업이 있어서 구분된다
const STAR3_LIMITED_MIN = 1000;

/** ★3 한정 배너 ID → 그 배너에서 나오는 ★3 카드 ID */
export type Star3Limited = Map<number, number[]>;

/** 실패하면 빈 표. umapyoi 픽업 목록에 없는 ★3 한정 카드만 빠진다 */
export async function getStar3Limited(outfitCard: KoLookup["outfitCard"]): Promise<Star3Limited> {
  const limited: Star3Limited = new Map();
  try {
    const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
    // 유료 전용 가챠도 umapyoi 픽업 목록이 비어 있는 일이 있어 함께 본다.
    // 그 밖의 특수 가챠는 정체를 알 수 없는 월간·상설 배너라 넣지 않는다
    const [standard, special] = await Promise.all([
      getJson<RawCharBanner[]>(`${BASE}/umamusume/gacha/char-standard.${manifest["gacha/char-standard"]}.json`),
      getJson<(RawCharBanner & RawSpecialBanner)[]>(`${BASE}/umamusume/gacha/special.${manifest["gacha/special"]}.json`),
    ]);
    for (const b of [...standard, ...special.filter((s) => s.restriction === "premium")]) {
      if ((b.pickups ?? []).some((p) => p[2])) continue;
      const star3 = Object.entries(b.lineup).flatMap(([key, ids]) =>
        ids.filter((id) => outfitCard.get(id)?.rarity === 3).map((id) => ({ id, rate: Number(key) })),
      );
      if (star3.length > 0 && star3.every((c) => c.rate >= STAR3_LIMITED_MIN)) {
        limited.set(
          b.id,
          star3.map((c) => c.id),
        );
      }
    }
  } catch (err) {
    // 이 정보가 없어도 일정표는 그대로 동작한다
    logFailure("gametora ★3 한정 배너", err);
  }
  return limited;
}

// 특수 가챠 배너. restriction이 "premium"이면 유료 쥬얼로만 돌릴 수 있다
type RawSpecialBanner = { id: number; restriction?: string };

/** 유료 쥬얼 전용 배너 ID. 실패하면 빈 집합이라 표시만 빠진다 */
export async function getPaidOnlyIds(): Promise<Set<number>> {
  try {
    const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
    const banners = await getJson<RawSpecialBanner[]>(
      `${BASE}/umamusume/gacha/special.${manifest["gacha/special"]}.json`,
    );
    return new Set(banners.filter((b) => b.restriction === "premium").map((b) => b.id));
  } catch (err) {
    logFailure("gametora 유료 쥬얼 전용 배너", err);
    return new Set();
  }
}

// 사료계산기에 넣는 기간 한정 보상. 아이템 ID: 43 쥬얼(무료), 41 육성 뽑기 티켓, 111 서포트 카드 뽑기 티켓
const ITEM_JEWEL = 43;
const ITEM_TRAIN_TICKET = 41;
const ITEM_SUPPORT_TICKET = 111;
// 신데렐라 그레이 방영 기념 캠페인은 한일 동시 진행이라 계산에서 뺀다
const EXCLUDED_EVENT = /シンデレラグレイ|Cinderella Gray/i;

type RawLimitedMissions = {
  eventId: number;
  eventOriginal: string;
  eventEn?: string;
  /** 밀리초 */
  startDate: number;
  endDate: number;
  missions: { itemId: number; itemNumber: number }[];
};
type RawStoryEvent = { id: number; name_ja?: string; name_ko?: string; start_ja: number; end_ja: number };
type RawStoryRewards = { id: number; rewards: { item_id: number; item_num: number }[] };
/** 스토리 이벤트 빙고. 시트마다 줄 보상에 쥬얼이 있다. can_loop 시트는 다시 돌 수 있지만 몇 번 도는지 정해지지 않아 한 번만 센다 */
type RawStoryBingo = { id: number; bingo: { can_loop: number; line_rewards: { item_id: number; item_num: number }[] }[] };
/** 트레이너 시험 기간 한정 미션. 개최마다 같은 목록 안에 기간(밀리초)만 다르게 들어 있다 */
type RawExamMissions = {
  missions: { itemId: number; itemNumber: number; startDate: number; endDate: number; subMissions?: { itemId: number; itemNumber: number }[] }[];
};

function rewardTotals(items: { id: number; num: number }[]) {
  const total = (id: number) => items.filter((i) => i.id === id).reduce((a, i) => a + i.num, 0);
  return { free: total(ITEM_JEWEL), trainTickets: total(ITEM_TRAIN_TICKET), supportTickets: total(ITEM_SUPPORT_TICKET) };
}

/** 기간 한정 미션과 스토리 이벤트 포인트 보상 중 쥬얼이나 뽑기 티켓을 주는 것. 날짜는 한국서버 예상일 */
export async function getJewelIncomes(): Promise<Income[]> {
  const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
  const [limited, stories, rewards, bingos, exams] = await Promise.all([
    getJson<RawLimitedMissions[]>(`${BASE}/umamusume/missions/limited.${manifest["missions/limited"]}.json`),
    getJson<RawStoryEvent[]>(`${BASE}/umamusume/events/story-events.${manifest["events/story-events"]}.json`),
    getJson<RawStoryRewards[]>(
      `${BASE}/umamusume/events/story-events-rewards.${manifest["events/story-events-rewards"]}.json`,
    ),
    getJson<RawStoryBingo[]>(`${BASE}/umamusume/events/story-events-bingo.${manifest["events/story-events-bingo"]}.json`),
    getJson<RawExamMissions | RawExamMissions[]>(
      `${BASE}/umamusume/missions/trainerexam-limited.${manifest["missions/trainerexam-limited"]}.json`,
    ),
  ]);

  const incomes: Income[] = [];

  // 트레이너 시험: 같은 기간끼리 묶어 개최 하나로 센다
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
    incomes.push({
      id: `exam-${g.start}`,
      source: "limited",
      name: "트레이너 시험 기간 한정 미션",
      startKr: jpToKr(dayFromTimestamp(g.start / 1000)),
      endKr: jpToKr(dayFromTimestamp(g.end / 1000)),
      ...t,
    });
  }

  for (const e of limited) {
    if (EXCLUDED_EVENT.test(`${e.eventOriginal} ${e.eventEn ?? ""}`)) continue;
    const t = rewardTotals(e.missions.map((m) => ({ id: m.itemId, num: m.itemNumber })));
    if (t.free + t.trainTickets + t.supportTickets === 0) continue;
    incomes.push({
      id: `limited-${e.eventId}`,
      source: "limited",
      name: e.eventOriginal,
      startKr: jpToKr(dayFromTimestamp(e.startDate / 1000)),
      endKr: jpToKr(dayFromTimestamp(e.endDate / 1000)),
      ...t,
    });
  }

  const rewardMap = new Map(rewards.map((r) => [r.id, r.rewards]));
  const bingoMap = new Map(bingos.map((b) => [b.id, b.bingo.flatMap((sheet) => sheet.line_rewards)]));
  for (const s of stories) {
    const name = fixKo(s.name_ko) || s.name_ja || `스토리 이벤트 ${s.id}`;
    if (EXCLUDED_EVENT.test(name)) continue;
    const t = rewardTotals(
      [...(rewardMap.get(s.id) ?? []), ...(bingoMap.get(s.id) ?? [])].map((r) => ({ id: r.item_id, num: r.item_num })),
    );
    if (t.free + t.trainTickets + t.supportTickets === 0) continue;
    incomes.push({
      id: `story-${s.id}`,
      source: "story",
      name,
      startKr: jpToKr(dayFromTimestamp(s.start_ja)),
      endKr: jpToKr(dayFromTimestamp(s.end_ja)),
      ...t,
    });
  }
  return incomes.sort((a, b) => a.startKr - b.startKr);
}

type RawChampionsMeeting = { id: number; name?: string; start: number; end: number };
type RawLegendRace = { name_ja?: string; start: number; end: number; races?: { start: number }[] };

/** 챔피언스 미팅·레전드 레이스(gametora 일정)와 리그 오브 히어로즈(고정 이력) 개최일. 날짜는 한국서버 예상일 */
export async function getCompetitionSchedule(): Promise<Scheduled[]> {
  const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
  const [cms, legends] = await Promise.all([
    getJson<RawChampionsMeeting[]>(
      `${BASE}/umamusume/events/champions-meeting.${manifest["events/champions-meeting"]}.json`,
    ),
    getJson<RawLegendRace[]>(`${BASE}/umamusume/events/legend-race.${manifest["events/legend-race"]}.json`),
  ]);
  const kr = (ts: number) => jpToKr(dayFromTimestamp(ts));
  const lohDays = 9;
  return [
    ...cms.map((c): Scheduled => ({ kind: "cm", id: `cm-${c.id}`, name: c.name ?? "", startKr: kr(c.start), endKr: kr(c.end) })),
    ...legends.map((l): Scheduled => ({
      kind: "legend",
      id: `legend-${l.start}`,
      name: l.name_ja ?? "",
      startKr: kr(l.start),
      endKr: kr(l.end),
      raceStartsKr: (l.races ?? []).map((r) => kr(r.start)),
    })),
    ...lohStartsKr().map((d): Scheduled => ({ kind: "loh", id: `loh-${d}`, name: "", startKr: d, endKr: d + lohDays })),
  ];
}
