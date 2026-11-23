// gametora 데이터를 가져와 화면에서 쓰는 모양으로 바꾼다.
// 파일 이름에 해시가 붙어 있어서 manifest로 현재 파일을 찾는다. 날짜는 모두 한국(카카오) 서버 기준이다.
import "server-only";
import { bannerArt, outfitArt, supportArt } from "./art";
import { dayFromTimestamp } from "./dates";
import { fetchJson, logFailure } from "./fetchJson";
import { fixKo, stripBrackets } from "./koName";

const BASE = "https://gametora.com/data";
const REVALIDATE = 3600;

type Manifest = Record<string, string>;

async function manifest(): Promise<Manifest> {
  return fetchJson<Manifest>(`${BASE}/manifests/umamusume.json`, REVALIDATE);
}

async function load<T>(key: string): Promise<T> {
  const m = await manifest();
  const hash = m[key];
  if (!hash) throw new Error(`manifest에 ${key} 없음`);
  return fetchJson<T>(`${BASE}/umamusume/${key}.${hash}.json`, REVALIDATE);
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
  release_ko?: string;
  obtained: string;
  type: SupportType;
  url_name: string;
};

const dayFromIso = (iso?: string) => (iso ? Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000) : null);

export async function getCards(): Promise<Card[]> {
  return safe(
    "gametora 카드",
    async () => {
      const [chars, supports] = await Promise.all([
        load<RawCharacterCard[]>("character-cards"),
        load<RawSupportCard[]>("support-cards"),
      ]);
      const train = chars.map(
        (c): Card => ({
          lane: "train",
          id: c.card_id,
          charId: c.char_id,
          name: fixKo(c.name_ko) || c.name_jp || String(c.card_id),
          title: stripBrackets(fixKo(c.title_ko) || c.title_jp),
          rarity: c.rarity,
          art: outfitArt(c.char_id, c.card_id),
          releaseKr: dayFromIso(c.release_ko),
          obtained: c.obtained,
          aptitude: c.aptitude,
          urlName: c.url_name,
        }),
      );
      const support = supports.map(
        (s): Card => ({
          lane: "support",
          id: s.support_id,
          charId: s.char_id,
          name: fixKo(s.name_ko) || s.name_jp || String(s.support_id),
          title: stripBrackets(fixKo(s.title_ko) || s.title_ja),
          rarity: s.rarity,
          art: supportArt(s.support_id, !!s.release_ko),
          releaseKr: dayFromIso(s.release_ko),
          obtained: s.obtained,
          supportType: s.type,
          urlName: s.url_name,
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
          name: fixKo(c.name_ko) || c.name_ja || String(c.char_id),
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

export async function getBanners(cards?: Card[]): Promise<Banner[]> {
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
      const all = [...charStd.map((b) => toBanner(b, "train", false)), ...supStd.map((b) => toBanner(b, "support", false)), ...paid]
        .filter((b) => b.startTs < FAR_FUTURE)
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

// ── 이벤트 ────────────────────────────────────────────

export type EventKind = "story" | "cm" | "loh" | "legend";

export type GameEvent = {
  kind: EventKind;
  id: string;
  name: string;
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
  bonus_chars?: { card_id: number; char_id: number }[];
  event_support_ids?: number[];
};
type RawRaceName = { name_ja: string; name_ko?: string };

const ground = (g: number) => (g === 2 ? "더트" : "잔디") as "잔디" | "더트";

export async function getEvents(cards?: Card[]): Promise<GameEvent[]> {
  const list = cards ?? (await getCards());
  const idx = cardIndex(list);
  const [cm, loh, legend, story, races] = await Promise.all([
    safe("gametora 챔피언스 미팅", () => load<RawCm[]>("ko/events/champions-meeting"), []),
    safe("gametora 리그 오브 히어로즈", () => load<RawLoh[]>("ko/events/league-of-heroes"), []),
    safe("gametora 레전드 레이스", () => load<RawLegend[]>("ko/events/legend-race"), []),
    safe("gametora 스토리 이벤트", () => load<RawStory[]>("events/story-events"), []),
    safe("gametora 경주 이름", () => load<RawRaceName[]>("races"), []),
  ]);
  const raceKo = new Map(races.map((r) => [r.name_ja, r.name_ko]));
  const base = (startTs: number, endTs: number) => ({
    startTs,
    endTs,
    start: dayFromTimestamp(startTs),
    end: dayFromTimestamp(endTs),
  });
  const events: GameEvent[] = [
    ...cm.map(
      (e): GameEvent => ({
        kind: "cm",
        id: `cm-${e.id}`,
        name: e.name,
        ...base(e.start, e.end),
        race: { ground: ground(e.race.ground), distance: e.race.distance, track: TRACK_NAME[e.race.track] },
      }),
    ),
    ...loh.map(
      (e): GameEvent => ({
        kind: "loh",
        id: `loh-${e.id}`,
        name: `리그 오브 히어로즈 #${e.id}`,
        ...base(e.start, e.end),
        race: { ground: ground(e.race.ground), distance: e.race.distance, track: TRACK_NAME[e.race.track] },
      }),
    ),
    ...legend.map(
      (e, i): GameEvent => ({
        kind: "legend",
        id: `legend-${e.races[0]?.id ?? i}`,
        name: fixKo(raceKo.get(e.name_ja)) || e.name_ja,
        ...base(e.start, e.end),
        race: { ground: ground(e.ground), distance: e.distance },
        rivals: e.races.flatMap((r) => {
          const c = idx.train.get(r.card_id);
          return c ? [c] : [];
        }),
        raceStarts: e.races.map((r) => dayFromTimestamp(r.start)),
      }),
    ),
    ...story
      .filter((e) => e.start_ko && e.end_ko)
      .map(
        (e): GameEvent => ({
          kind: "story",
          id: `story-${e.id}`,
          name: fixKo(e.name_ko) || e.name_ja || String(e.id),
          ...base(e.start_ko as number, e.end_ko as number),
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
