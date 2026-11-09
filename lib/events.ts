import { dayFromTimestamp, jpToKr } from "./dates";
import { anniversaryName, g1RaceOf, isG1Mission, type EventKind, type GameEvent } from "./eventCalendar";
import { fetchJson, logFailure } from "./fetchJson";
import { getKoLookup } from "./gametora";
import { fixKo } from "./koNameFallback";

// 이벤트 일정은 모두 gametora 데이터에서 만든다. 날짜는 일본서버 날짜에 476일을 더한 한국서버 예상일
const BASE = "https://gametora.com/data";
const REVALIDATE = 86_400;
const getJson = <T>(url: string) => fetchJson<T>(url, REVALIDATE);

type Manifest = Record<string, string>;
type RaceSpec = { distance: number; ground: number };

type RawChampionsMeeting = { id: number; name?: string; start: number; end: number; race?: RaceSpec };
type RawLeagueOfHeroes = { id: number; start: number; end: number; race?: RaceSpec };
type RawLegendRace = { name_ja?: string; start: number; end: number; races?: { card_id: number }[] };
type RawStoryEvent = { id: number; name_ja?: string; name_ko?: string; start_ja: number; end_ja: number };
type RawRace = { name_ja: string; name_ko?: string };
/** 개최마다 기간(밀리초)이 다른 미션이 한 목록에 섞여 있는 파일 (기능시험·레이싱 카니발·팀 스카우트) */
type RawPeriodMissions = { missions: { startDate: number; endDate: number }[] }[];
type RawLimitedMissions = { eventId: number; eventOriginal: string; startDate: number; endDate: number };

/** 초 단위 일본서버 시각 → 한국서버 예상일 */
const kr = (ts: number) => jpToKr(dayFromTimestamp(ts));
const krMs = (ms: number) => kr(Math.floor(ms / 1000));

const course = (r?: RaceSpec) => (r ? `${r.ground === 2 ? "더트" : "잔디"} ${r.distance}m` : "");

// G1 기념 미션 이름에 쓰인 줄임말 → gametora 레이스 표의 일본어 정식 이름
const G1_SHORT: Record<string, string> = {
  スプリンターズS: "スプリンターズステークス",
  マイルCS: "マイルチャンピオンシップ",
  マイルCS南部杯: "マイルチャンピオンシップ南部杯",
  NHKマイル: "NHKマイルカップ",
  NHKマイルC: "NHKマイルカップ",
  日本ダービー: "東京優駿（日本ダービー）",
  ジャパンC: "ジャパンカップ",
  チャンピオンズC: "チャンピオンズカップ",
  阪神JF: "阪神ジュベナイルフィリーズ",
  阪神ジュベナイルF: "阪神ジュベナイルフィリーズ",
  朝日杯FS: "朝日杯フューチュリティステークス",
  ホープフルS: "ホープフルステークス",
  フェブラリーS: "フェブラリーステークス",
  JDダービー: "ジャパンダートダービー",
};

// 몇 달씩 열려 있는 상설 미션(リリース記念, 名トレーナーへの道 등)은 일정이 아니라서 뺀다
const MAX_MISSION_DAYS = 62;

function missionName(original: string): string {
  if (/新育成シナリオ公開記念/.test(original)) return "새 육성 시나리오 공개 기념 미션";
  return original;
}

/** 같은 기간 미션을 개최 하나로 묶는다 */
function holdings(files: RawPeriodMissions, kind: EventKind): GameEvent[] {
  const periods = new Map<string, { start: number; end: number }>();
  for (const m of files.flatMap((f) => f.missions)) {
    periods.set(`${m.startDate}-${m.endDate}`, { start: m.startDate, end: m.endDate });
  }
  return [...periods.values()].map((p) => ({
    id: `${kind}-${p.start}`,
    kind,
    name: "",
    detail: "",
    startKr: krMs(p.start),
    endKr: krMs(p.end),
  }));
}

export type EventSchedule = {
  events: GameEvent[];
  /** 불러오지 못한 종류. 나머지 종류는 그대로 보여준다 */
  failed: EventKind[];
};

/** 이벤트 일정 전체. gametora manifest를 못 받으면 예외를 던진다 */
export async function getEventSchedule(): Promise<EventSchedule> {
  const manifest = await getJson<Manifest>(`${BASE}/manifests/umamusume.json`);
  const file = <T>(key: string) => getJson<T>(`${BASE}/umamusume/${key}.${manifest[key]}.json`);

  // 레이스 한국어 이름(레전드 레이스·G1 기념)과 레전드 상대 이름은 없어도 일본어로 그린다
  const racesKo = file<RawRace[]>("races")
    .then((races) => new Map(races.filter((r) => r.name_ko).map((r) => [r.name_ja, r.name_ko!])))
    .catch((err) => {
      logFailure("gametora 레이스 이름", err);
      return new Map<string, string>();
    });
  const raceName = async (ja: string) => (await racesKo).get(G1_SHORT[ja] ?? ja) ?? ja;

  const loaders: { kinds: EventKind[]; load: () => Promise<GameEvent[]> }[] = [
    {
      kinds: ["cm"],
      load: async () => {
        const [cms, cmsKo] = await Promise.all([
          file<RawChampionsMeeting[]>("events/champions-meeting"),
          // 한국서버 개최분의 이름표. 같은 순번이 같은 대회다
          file<RawChampionsMeeting[]>("ko/events/champions-meeting").catch(() => []),
        ]);
        const koName = new Map(cmsKo.map((c) => [c.id, c.name]));
        return cms.map((c) => ({
          id: `cm-${c.id}`,
          kind: "cm",
          name: koName.get(c.id) ?? c.name ?? "",
          detail: course(c.race),
          startKr: kr(c.start),
          endKr: kr(c.end),
        }));
      },
    },
    {
      kinds: ["loh"],
      load: async () =>
        (await file<RawLeagueOfHeroes[]>("events/league-of-heroes")).map((l) => ({
          id: `loh-${l.id}`,
          kind: "loh",
          name: "",
          detail: course(l.race),
          startKr: kr(l.start),
          endKr: kr(l.end),
        })),
    },
    {
      kinds: ["legend"],
      load: async () => {
        const [legends, ko] = await Promise.all([file<RawLegendRace[]>("events/legend-race"), getKoLookup()]);
        const rival = (cardId: number) => {
          const card = ko.outfitCard.get(cardId);
          return card ? (ko.chara.get(card.charaId) ?? card.nameJp ?? "") : "";
        };
        return Promise.all(
          legends.map(async (l) => {
            const rivals = (l.races ?? []).map((r) => rival(r.card_id)).filter(Boolean);
            return {
              id: `legend-${l.start}`,
              kind: "legend" as const,
              name: l.name_ja ? await raceName(l.name_ja) : "",
              detail: rivals.length ? `상대 ${rivals.join(", ")}` : "",
              startKr: kr(l.start),
              endKr: kr(l.end),
            };
          }),
        );
      },
    },
    {
      kinds: ["story"],
      load: async () =>
        (await file<RawStoryEvent[]>("events/story-events")).map((s) => ({
          id: `story-${s.id}`,
          kind: "story",
          name: fixKo(s.name_ko) || s.name_ja || "",
          detail: "",
          startKr: kr(s.start_ja),
          endKr: kr(s.end_ja),
        })),
    },
    { kinds: ["exam"], load: async () => holdings(await file("missions/trainerexam-limited"), "exam") },
    { kinds: ["carnival"], load: async () => holdings(await file("missions/racingcarnival-limited"), "carnival") },
    { kinds: ["teamscout"], load: async () => holdings(await file("missions/teamscout-limited"), "teamscout") },
    {
      kinds: ["anniversary", "g1", "mission"],
      load: async () => {
        const limited = await file<RawLimitedMissions[]>("missions/limited");
        const out: GameEvent[] = [];
        for (const e of limited) {
          const startKr = krMs(e.startDate);
          const endKr = krMs(e.endDate);
          if (endKr - startKr + 1 > MAX_MISSION_DAYS) continue;
          const base = { id: `mission-${e.eventId}`, detail: "", startKr, endKr };
          const anniversary = anniversaryName(e.eventOriginal);
          if (anniversary) out.push({ ...base, kind: "anniversary", name: anniversary });
          else if (isG1Mission(e.eventOriginal)) {
            out.push({ ...base, kind: "g1", name: await raceName(g1RaceOf(e.eventOriginal)) });
          } else out.push({ ...base, kind: "mission", name: missionName(e.eventOriginal) });
        }
        return out;
      },
    },
  ];

  const results = await Promise.allSettled(loaders.map((l) => l.load()));
  const events: GameEvent[] = [];
  const failed: EventKind[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") events.push(...r.value);
    else {
      logFailure(`gametora 이벤트 일정 (${loaders[i].kinds.join(", ")})`, r.reason);
      failed.push(...loaders[i].kinds);
    }
  });
  return { events: events.sort((a, b) => a.startKr - b.startKr || a.id.localeCompare(b.id)), failed };
}
