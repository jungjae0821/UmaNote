// gametora 데이터를 가져와 화면에서 쓰는 모양으로 바꾼다.
// 파일 이름에 해시가 붙어 있어서 manifest로 현재 파일을 찾는다. 날짜는 모두 한국(카카오) 서버 기준이다.
import "server-only";
import { bannerArt, outfitArt, storyEventArt, supportArt } from "./art";
import { dayFromTimestamp, SERVER_GAP_DAYS } from "./dates";
import { fetchJson, logFailure } from "./fetchJson";
import { fixKo, stripBrackets } from "./koName";
import { namuCardTitle, namuCharName, namuSupportArt, realKo } from "./namuKo";

const BASE = "https://gametora.com/data";
const REVALIDATE = 3600;

type Manifest = Record<string, string>;

async function manifest(): Promise<Manifest> {
  return fetchJson<Manifest>(`${BASE}/manifests/umamusume.json`, REVALIDATE);
}

/** 현재 해시가 붙은 데이터 파일 주소 */
export async function dataUrl(key: string): Promise<string> {
  const m = await manifest();
  const hash = m[key];
  if (!hash) throw new Error(`manifest에 ${key} 없음`);
  return `${BASE}/umamusume/${key}.${hash}.json`;
}

export async function load<T>(key: string): Promise<T> {
  return fetchJson<T>(await dataUrl(key), REVALIDATE);
}

/** 실패하면 fallback을 돌려주고 서버 로그에 남긴다 */
async function safe<T>(what: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logFailure(what, err);
    return fallback;
  }
}

// ── 카드 ─────────────────────────────────────────────

export type Lane = "train" | "support";
export type SupportType = "speed" | "stamina" | "power" | "guts" | "intelligence" | "friend" | "group";

export type Card = {
  lane: Lane;
  id: number;
  charId: number;
  name: string;
  /** 대괄호를 뗀 의상·카드 제목 */
  title: string;
  /** 육성은 초기 ★(1–3), 서포트는 1 R · 2 SR · 3 SSR */
  rarity: number;
  art: string;
  /** 한국서버 출시일(일 번호). 아직이면 null */
  releaseKr: number | null;
  /** 일본서버 출시일(일 번호) */
  releaseJp: number | null;
  obtained: string;
  supportType?: SupportType;
  /** 육성만: 잔디·더트·단거리·마일·중거리·장거리·도주·선행·선입·추입 */
  aptitude?: string[];
  urlName: string;
};

type RawCharacterCard = {
  card_id: number;
  char_id: number;
  rarity: number;
  name_ko?: string;
  name_jp?: string;
  title_ko?: string;
  title_jp?: string;
  release?: string;
  release_ko?: string;
  obtained: string;
  aptitude?: string[];
  url_name: string;
};

type RawSupportCard = {
  support_id: number;
  char_id: number;
  rarity: number;
  name_ko?: string;
  name_jp?: string;
  title_ko?: string;
  title_ja?: string;
  release?: string;
  release_ko?: string;
  obtained: string;
  type: SupportType;
  url_name: string;
};

const SUPPORT_RARITY = ["", "R", "SR", "SSR"];

const dayFromIso = (iso?: string) => (iso ? Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000) : null);

export async function getCards(): Promise<Card[]> {
  return safe(
    "gametora 카드",
    async () => {
      const [chars, supports] = await Promise.all([
        load<RawCharacterCard[]>("character-cards"),
        load<RawSupportCard[]>("support-cards"),
      ]);
      // 한국어가 없는 미출시 카드는 나무위키 표기로 채운다
      const train = chars.map((c): Card => {
        const name = fixKo(c.name_ko) || namuCharName(c.name_jp) || c.name_jp || String(c.card_id);
        return {
          lane: "train",
          id: c.card_id,
          charId: c.char_id,
          name,
          title: stripBrackets(fixKo(realKo(c.title_ko, c.title_jp)) || namuCardTitle(name, "t", c.title_jp, c.release) || c.title_jp),
          rarity: c.rarity,
          art: outfitArt(c.char_id, c.card_id),
          releaseKr: dayFromIso(c.release_ko),
          releaseJp: dayFromIso(c.release),
          obtained: c.obtained,
          aptitude: c.aptitude,
          urlName: c.url_name,
        };
      });
      const support = supports.map((s): Card => {
        const name = fixKo(s.name_ko) || namuCharName(s.name_jp) || s.name_jp || String(s.support_id);
        return {
          lane: "support",
          id: s.support_id,
          charId: s.char_id,
          name,
          title: stripBrackets(fixKo(realKo(s.title_ko, s.title_ja)) || namuCardTitle(name, SUPPORT_RARITY[s.rarity], s.title_ja, s.release) || s.title_ja),
          rarity: s.rarity,
          art: supportArt(s.support_id, !!s.release_ko),
          releaseKr: dayFromIso(s.release_ko),
          releaseJp: dayFromIso(s.release),
          obtained: s.obtained,
          supportType: s.type,
          urlName: s.url_name,
        };
      });
      // 한국서버 미출시 카드도 gametora에 큰 일러스트가 먼저 올라오는 경우가 많아서, 있으면 그걸 쓴다.
      // 아직 없는 최신 카드는 나무위키 카드 이미지, 그마저 없으면 gametora 작은 그림
      await Promise.all(
        support
          .filter((c) => c.releaseKr === null)
          .map(async (c) => {
            const big = await existing(supportArt(c.id, true));
            c.art = big ?? namuSupportArt(c.id) ?? c.art;
          }),
      );
      return [...train, ...support];
    },
    [],
  );
}

export function cardIndex(cards: Card[]) {
  const train = new Map<number, Card>();
  const support = new Map<number, Card>();
  for (const c of cards) (c.lane === "train" ? train : support).set(c.id, c);
  return { train, support, get: (lane: Lane, id: number) => (lane === "train" ? train : support).get(id) };
}

// ── 한국서버 출시 예상일 ──────────────────────────────

type RawPredicted = Record<"char_cards" | "support_cards", Record<string, { release_date: string; banner_id?: number }>>;

/** gametora가 일본서버 일정으로 계산한 한국서버 출시 예상일. 키는 "train:카드 ID" */
export async function getPredictedReleases(): Promise<Map<string, number>> {
  return safe(
    "gametora 출시 예상일",
    async () => {
      const raw = await load<RawPredicted>("ko/foresight/predicted_releases");
      const map = new Map<string, number>();
      for (const [lane, key] of [["train", "char_cards"], ["support", "support_cards"]] as const) {
        for (const [id, p] of Object.entries(raw[key] ?? {})) {
          const day = dayFromIso(p.release_date);
          if (day !== null) map.set(`${lane}:${id}`, day);
        }
      }
      return map;
    },
    new Map(),
  );
}

// ── 캐릭터 (생일) ─────────────────────────────────────

export type Character = {
  charId: number;
  name: string;
  birthMonth: number;
  birthDay: number;
  /** 한국서버에서 육성할 수 있는 캐릭터 */
  playableKr: boolean;
  color: string;
};

type RawCharacter = {
  char_id: number;
  name_ko?: string;
  name_ja?: string;
  birth_month?: number;
  birth_day?: number;
  playable_ko?: boolean;
  color_main?: string;
};

export async function getCharacters(): Promise<Character[]> {
  return safe(
    "gametora 캐릭터",
    async () => {
      const raw = await load<RawCharacter[]>("characters");
      return raw
        .filter((c) => c.birth_month && c.birth_day)
        .map((c) => ({
          charId: c.char_id,
          name: fixKo(c.name_ko) || namuCharName(c.name_ja) || c.name_ja || String(c.char_id),
          birthMonth: c.birth_month as number,
          birthDay: c.birth_day as number,
          playableKr: !!c.playable_ko,
          color: c.color_main ?? "#888888",
        }));
    },
    [],
  );
}

// ── 가챠 배너 ─────────────────────────────────────────

type RawBanner = {
  id: number;
  start: number;
  end: number;
  /** 키는 카드 하나의 확률(0.0001% 단위, 7500 = 0.75%), 값은 카드 ID */
  lineup: Record<string, number[]>;
  /** [카드 ID, 확률, 신규 여부] */
  pickups?: [number, number, boolean][];
  /** ★3·★2·★1 확률 합 (기본과 다른 배너만) */
  rarityOdds?: [number, number, number];
  restriction?: string;
};

type RawTimeline = {
  future_char_banners: { id: number; is_estimated: boolean }[];
  future_support_banners: { id: number; is_estimated: boolean }[];
};

export type Pickup = { card: Card; rate: number; isNew: boolean };

export type Banner = {
  id: number;
  lane: Lane;
  startTs: number;
  endTs: number;
  start: number;
  end: number;
  pickups: Pickup[];
  lineup: Record<string, number[]>;
  /** gametora가 날짜를 추정한 미래 배너 */
  estimated: boolean;
  /** 유료 쥬얼로만 돌릴 수 있는 배너 */
  paidOnly: boolean;
  /** ★3 확률이 기본(3%)보다 높은 배너 */
  star3Up: boolean;
  /** 한국서버 배너 이미지. 아직 올라오지 않은 먼 미래 배너는 null */
  art: string | null;
};

/** 시작 전 배너는 이미지가 아직 없을 수 있어서 있는지 확인한다 (하루 캐시) */
async function existing(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD", next: { revalidate: 86_400 } });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/** 날짜가 정해지지 않은 자리표시 배너(2099년 등)를 거른다 */
const FAR_FUTURE = Date.UTC(2035, 0, 1) / 1000;

/**
 * jpProjection: 한국서버 일정이 아직 없는 일본서버 배너(현재 일본에서 진행 중인 것까지)를
 * 일본 날짜 + 476일로 옮겨 덧붙인다. 같은 배너는 한일 ID가 같다.
 */
export async function getBanners(cards?: Card[], opts: { jpProjection?: boolean } = {}): Promise<Banner[]> {
  const list = cards ?? (await getCards());
  const idx = cardIndex(list);
  return safe(
    "gametora 가챠 배너",
    async () => {
      const [charStd, supStd, special, timeline] = await Promise.all([
        load<RawBanner[]>("ko/gacha/char-standard"),
        load<RawBanner[]>("ko/gacha/support-standard"),
        safe("gametora 특수 가챠", () => load<RawBanner[]>("ko/gacha/special"), []),
        safe("gametora 미래 일정", () => load<RawTimeline>("ko/foresight/timeline"), {
          future_char_banners: [],
          future_support_banners: [],
        }),
      ]);
      const estimated = new Set(
        [...timeline.future_char_banners, ...timeline.future_support_banners].filter((b) => b.is_estimated).map((b) => b.id),
      );
      const toBanner = (b: RawBanner, lane: Lane, paidOnly: boolean): Banner => ({
        id: b.id,
        lane,
        startTs: b.start,
        endTs: b.end,
        start: dayFromTimestamp(b.start),
        end: dayFromTimestamp(b.end),
        pickups: (b.pickups ?? []).flatMap(([id, rate, isNew]) => {
          const card = idx.get(lane, id);
          return card ? [{ card, rate, isNew }] : [];
        }),
        lineup: b.lineup,
        estimated: estimated.has(b.id),
        paidOnly,
        star3Up: !!b.rarityOdds && b.rarityOdds[0] > 30_000,
        art: bannerArt(b.id),
      });
      // 유료 전용 특수 가챠만 일정에 넣는다. 나머지 특수 가챠는 정체를 알 수 없는 상설·월간 배너다
      const paid = special
        // 몇 년씩 열려 있는 상설 유료 가챠는 일정이 아니라서 뺀다
        .filter((b) => b.restriction === "premium" && b.end - b.start < 60 * 86_400)
        .map((b) => {
          const ids = Object.values(b.lineup).flat();
          const lane: Lane = ids.some((id) => idx.support.has(id)) && !ids.some((id) => idx.train.has(id)) ? "support" : "train";
          const banner = toBanner(b, lane, true);
          // 유료 전용 배너는 pickups가 비어 있어서, 골라 뽑는 ★3·SSR 목록(카드마다 0.1% 이상)을 픽업으로 본다
          if (banner.pickups.length === 0) {
            banner.pickups = Object.entries(b.lineup)
              .filter(([rate]) => Number(rate) >= 1000)
              .flatMap(([rate, ids]) =>
                ids.flatMap((id) => {
                  const card = idx.get(lane, id);
                  return card && card.rarity === 3 ? [{ card, rate: Number(rate), isNew: false }] : [];
                }),
              );
          }
          return banner;
        });
      const kr = [...charStd.map((b) => toBanner(b, "train", false)), ...supStd.map((b) => toBanner(b, "support", false)), ...paid].filter(
        (b) => b.startTs < FAR_FUTURE,
      );
      const projected = opts.jpProjection ? await jpProjectedBanners(kr, toBanner) : [];
      const all = [...kr, ...projected]
        .sort((a, b) => a.startTs - b.startTs || a.id - b.id);
      const now = Date.now() / 1000;
      await Promise.all(
        all.filter((b) => b.startTs > now && b.art).map(async (b) => {
          b.art = await existing(b.art as string);
        }),
      );
      return all;
    },
    [],
  );
}

/** 한국 일정의 마지막 배너보다 뒤에 오는 일본서버 배너를 +476일로 옮긴다. 이미지는 한국서버 것이 없어서 넣지 않는다 */
async function jpProjectedBanners(kr: Banner[], toBanner: (b: RawBanner, lane: Lane, paidOnly: boolean) => Banner): Promise<Banner[]> {
  const gap = SERVER_GAP_DAYS * 86_400;
  const known = new Set(kr.map((b) => b.id));
  const result: Banner[] = [];
  for (const lane of ["train", "support"] as const) {
    const lastKr = Math.max(0, ...kr.filter((b) => b.lane === lane && !b.paidOnly).map((b) => b.startTs));
    const jp = await safe(`gametora 일본서버 ${lane} 배너`, () => load<RawBanner[]>(lane === "train" ? "gacha/char-standard" : "gacha/support-standard"), []);
    for (const b of jp) {
      if (known.has(b.id) || b.start + gap <= lastKr || b.start >= FAR_FUTURE) continue;
      result.push({ ...toBanner({ ...b, start: b.start + gap, end: b.end + gap }, lane, false), estimated: true, art: null });
    }
  }
  return result;
}

// ── 이벤트 ────────────────────────────────────────────

export type EventKind = "story" | "cm" | "loh" | "legend";

export type GameEvent = {
  kind: EventKind;
  id: string;
  name: string;
  /** 스토리 이벤트 ID에 대응하는 원본 배너 */
  art?: string;
  start: number;
  end: number;
  startTs: number;
  endTs: number;
  /** 경기 조건 (잔디 2400m, 도쿄) */
  race?: { ground: "잔디" | "더트"; distance: number; track?: string };
  /** 스토리 이벤트: 보너스 육성 카드, 보상 서포트 카드 */
  bonusCards?: Card[];
  rewardSupports?: Card[];
  /** 레전드 레이스: 상대 레전드 카드 */
  rivals?: Card[];
  /** 레전드 레이스: 상대마다 열리는 날 */
  raceStarts?: number[];
  /** 한국서버 일정이 아직 없어 일본서버 날짜 +476일로 잡은 이벤트 */
  estimated?: boolean;
};

export const EVENT_KIND_NAME: Record<EventKind, string> = {
  story: "스토리 이벤트",
  cm: "챔피언스 미팅",
  loh: "리그 오브 히어로즈",
  legend: "레전드 레이스",
};

const TRACK_NAME: Record<number, string> = {
  10001: "삿포로", 10002: "하코다테", 10003: "니가타", 10004: "후쿠시마", 10005: "나카야마",
  10006: "도쿄", 10007: "주쿄", 10008: "교토", 10009: "한신", 10010: "고쿠라",
  10101: "오이", 10103: "가와사키", 10104: "후나바시", 10105: "모리오카", 10201: "롱샹", 10202: "산타아니타",
};

type RawRace = { ground: number; distance: number; track: number };
type RawCm = { id: number; name: string; start: number; end: number; race: RawRace };
type RawLoh = { id: number; start: number; end: number; race: RawRace };
type RawLegend = {
  name_ja: string;
  start: number;
  end: number;
  distance: number;
  ground: number;
  races: { id: number; card_id: number; start: number; end: number }[];
};
type RawStory = {
  id: number;
  name_ko?: string;
  name_ja?: string;
  start_ko?: number;
  end_ko?: number;
  start_ja?: number;
  end_ja?: number;
  bonus_chars?: { card_id: number; char_id: number }[];
  event_support_ids?: number[];
};
type RawRaceName = { name_ja: string; name_ko?: string };

const ground = (g: number) => (g === 2 ? "더트" : "잔디") as "잔디" | "더트";

export async function getEvents(cards?: Card[]): Promise<GameEvent[]> {
  const list = cards ?? (await getCards());
  const idx = cardIndex(list);
  const [cmKo, lohKo, legendKo, cmJp, lohJp, legendJp, story, races] = await Promise.all([
    safe("gametora 챔피언스 미팅", () => load<RawCm[]>("ko/events/champions-meeting"), []),
    safe("gametora 리그 오브 히어로즈", () => load<RawLoh[]>("ko/events/league-of-heroes"), []),
    safe("gametora 레전드 레이스", () => load<RawLegend[]>("ko/events/legend-race"), []),
    safe("gametora 챔피언스 미팅(일본)", () => load<RawCm[]>("events/champions-meeting"), []),
    safe("gametora 리그 오브 히어로즈(일본)", () => load<RawLoh[]>("events/league-of-heroes"), []),
    safe("gametora 레전드 레이스(일본)", () => load<RawLegend[]>("events/legend-race"), []),
    safe("gametora 스토리 이벤트", () => load<RawStory[]>("events/story-events"), []),
    safe("gametora 경주 이름", () => load<RawRaceName[]>("races"), []),
  ]);
  // 한국 파일에 아직 없는 일본서버 이벤트는 +476일로 옮겨 붙인다. ID는 두 서버가 같다
  const GAP = SERVER_GAP_DAYS * 86_400;
  const shift = <T extends { start: number; end: number }>(e: T): T & { estimated: true } => ({ ...e, start: e.start + GAP, end: e.end + GAP, estimated: true });
  const shiftLegend = (e: RawLegend) => ({ ...shift(e), races: e.races.map((r) => ({ ...r, start: r.start + GAP, end: r.end + GAP })) });
  const cmIds = new Set(cmKo.map((e) => e.id));
  const lohIds = new Set(lohKo.map((e) => e.id));
  const legendIds = new Set(legendKo.flatMap((e) => e.races.map((r) => r.id)));
  const cm: (RawCm & { estimated?: boolean })[] = [...cmKo, ...cmJp.filter((e) => !cmIds.has(e.id)).map(shift)];
  const loh: (RawLoh & { estimated?: boolean })[] = [...lohKo, ...lohJp.filter((e) => !lohIds.has(e.id)).map(shift)];
  const legend: (RawLegend & { estimated?: boolean })[] = [
    ...legendKo,
    ...legendJp.filter((e) => !e.races.some((r) => legendIds.has(r.id))).map(shiftLegend),
  ];
  const raceKo = new Map(races.map((r) => [r.name_ja, r.name_ko]));
  const base = (startTs: number, endTs: number, estimated?: boolean) => ({
    startTs,
    endTs,
    start: dayFromTimestamp(startTs),
    end: dayFromTimestamp(endTs),
    ...(estimated ? { estimated } : {}),
  });
  const events: GameEvent[] = [
    ...cm.map(
      (e): GameEvent => ({
        kind: "cm",
        id: `cm-${e.id}`,
        name: e.name,
        ...base(e.start, e.end, e.estimated),
        race: { ground: ground(e.race.ground), distance: e.race.distance, track: TRACK_NAME[e.race.track] },
      }),
    ),
    ...loh.map(
      (e): GameEvent => ({
        kind: "loh",
        id: `loh-${e.id}`,
        name: `리그 오브 히어로즈 #${e.id}`,
        ...base(e.start, e.end, e.estimated),
        race: { ground: ground(e.race.ground), distance: e.race.distance, track: TRACK_NAME[e.race.track] },
      }),
    ),
    ...legend.map(
      (e, i): GameEvent => ({
        kind: "legend",
        id: `legend-${e.races[0]?.id ?? i}`,
        name: fixKo(raceKo.get(e.name_ja)) || e.name_ja,
        ...base(e.start, e.end, e.estimated),
        race: { ground: ground(e.ground), distance: e.distance },
        // 레전드 전용 의상(104150 등)은 카드 목록에 없어서 같은 캐릭터의 기본 카드로 대신한다
        rivals: e.races.flatMap((r) => {
          const charId = Math.floor(r.card_id / 100);
          const c = idx.train.get(r.card_id) ?? idx.train.get(charId * 100 + 1) ?? list.find((x) => x.lane === "train" && x.charId === charId);
          return c ? [c] : [];
        }),
        raceStarts: e.races.map((r) => dayFromTimestamp(r.start)),
      }),
    ),
    ...story
      .filter((e) => (e.start_ko && e.end_ko) || (e.start_ja && e.end_ja))
      .map(
        (e): GameEvent => ({
          kind: "story",
          id: `story-${e.id}`,
          name: fixKo(e.name_ko) || e.name_ja || String(e.id),
          art: storyEventArt(e.id),
          ...(e.start_ko && e.end_ko
            ? base(e.start_ko, e.end_ko)
            : base((e.start_ja as number) + GAP, (e.end_ja as number) + GAP, true)),
          bonusCards: (e.bonus_chars ?? []).flatMap((b) => {
            const c = b.card_id ? idx.train.get(b.card_id) : undefined;
            return c ? [c] : [];
          }),
          rewardSupports: (e.event_support_ids ?? []).flatMap((id) => {
            const c = idx.support.get(id);
            return c ? [c] : [];
          }),
        }),
      ),
  ];
  return events.filter((e) => e.startTs < FAR_FUTURE).sort((a, b) => a.startTs - b.startTs);
}
