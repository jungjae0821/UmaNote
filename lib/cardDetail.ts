// 캐릭터 상세 화면용 데이터: 육성 카드의 능력치·적성·스킬, 서포트 카드의 효과·주는 스킬.
// 한국서버에 아직 없는 카드·스킬은 한국어 이름이 없어서 일본어 원문을 쓴다.
import "server-only";
import { unstable_cache } from "next/cache";
import { skillArt } from "./art";
import { logFailure } from "./fetchJson";
import { fixKo } from "./koName";
import { KANA, namuSkill, realKo } from "./namuKo";
import { dataUrl, load, type Lane } from "./gametora";

// ── 스킬 ──────────────────────────────────────────────

export type Skill = {
  id: number;
  name: string;
  desc: string;
  icon: string;
  /** 1 일반 · 2 레어(금색) · 3 이상 고유 */
  rarity: number;
  /** 한국서버에 번역된 이름이 없다 */
  untranslated: boolean;
};

type RawSkill = {
  id: number;
  iconid: number;
  rarity: number;
  name_ko?: string;
  desc_ko?: string;
  jpname: string;
  jpdesc: string;
};

const SKILLS_TTL = 43_200 * 1000;
let skillsCache: { at: number; data: Promise<Map<number, Skill>> } | null = null;

// 스킬 파일은 2MB가 넘어 Next.js 데이터 캐시에 그대로 들어가지 않는다. 쓰는 칸만 남겨(약 1MB) 캐시한다.
// fetch를 unstable_cache 안에서 해야 상세 페이지가 요청마다 새로 그려지지 않는다
const rawSkills = unstable_cache(
  async (): Promise<RawSkill[]> => {
    const res = await fetch(await dataUrl("skills"), { cache: "no-store" });
    if (!res.ok) throw new Error(`skills ${res.status}`);
    const raw = (await res.json()) as RawSkill[];
    return raw.map(({ id, iconid, rarity, name_ko, desc_ko, jpname, jpdesc }) => ({ id, iconid, rarity, name_ko, desc_ko, jpname, jpdesc }));
  },
  ["gametora-skills-v1"],
  { revalidate: 43_200 },
);

// 가공한 Map은 서버 메모리에 12시간 둔다
function getSkills(): Promise<Map<number, Skill>> {
  if (skillsCache && Date.now() - skillsCache.at < SKILLS_TTL) return skillsCache.data;
  const data = (async () => {
    const raw = await rawSkills();
    return new Map(
      raw.map((s): [number, Skill] => {
        // gametora는 번역이 없을 때 한국어 칸에 일본어 원문을 넣어 두기도 해서 그런 값은 버린다.
        // 그 자리는 나무위키 번역, 그마저 없으면 일본어 원문
        const nameKo = realKo(s.name_ko, s.jpname);
        const descKo = s.desc_ko && KANA.test(s.desc_ko) ? undefined : s.desc_ko;
        const namu = nameKo && descKo ? undefined : namuSkill(s.jpname);
        return [
          s.id,
          {
            id: s.id,
            name: fixKo(nameKo) || namu?.[0] || s.jpname,
            desc: fixKo(descKo) || namu?.[1] || s.jpdesc,
            icon: skillArt(s.iconid),
            rarity: s.rarity,
            untranslated: !nameKo && !namu,
          },
        ];
      }),
    );
  })();
  skillsCache = { at: Date.now(), data };
  data.catch(() => {
    skillsCache = null;
  });
  return data;
}

const pick = (skills: Map<number, Skill>, ids: number[] = []) =>
  ids.flatMap((id) => {
    const s = skills.get(id);
    return s ? [s] : [];
  });

// ── 육성 카드 ─────────────────────────────────────────

type RawCharacterCard = {
  card_id: number;
  rarity: number;
  base_stats: number[];
  two_star_stats?: number[];
  three_star_stats?: number[];
  four_star_stats: number[];
  five_star_stats: number[];
  stat_bonus: number[];
  aptitude: string[];
  skills_unique: number[];
  skills_innate: number[];
  skills_awakening: number[];
  skills_event: number[];
  release_ko?: string;
};

type RawEvolution = { old: number; new: number; servers?: string[] };
type RawCardEvolutions = { card_id?: number; evolutions: RawEvolution[] };

export type TrainDetail = {
  lane: "train";
  /** ★ 단계별 능력치 (스피드·스태미나·파워·근성·지능) */
  stats: { star: number; values: number[] }[];
  /** 성장률 % */
  growth: number[];
  /** 잔디·더트·단거리·마일·중거리·장거리·도주·선행·선입·추입 */
  aptitude: string[];
  /** 첫 번째가 지금 등급의 고유 스킬, 두 번째가 있으면 ★3 이상에서 바뀌는 고유 스킬 */
  unique: Skill[];
  innate: Skill[];
  /** 각성 Lv2부터 차례대로 */
  awakening: Skill[];
  event: Skill[];
  /** 진화 전 스킬 ID → 진화 스킬. 한 스킬이 둘로 갈라져 진화하기도 한다 */
  evolutions: Record<number, Skill[]>;
};

// ── 서포트 카드 ───────────────────────────────────────

type RawSupportCard = {
  support_id: number;
  rarity: number;
  /** [효과 ID, Lv1·5·10·…·50 값 11개]. -1은 앞 단계와 같음 */
  effects: number[][];
  event_skills: number[];
  hints: { hint_skills?: number[] };
  unique?: { level: number; effects: { type: number; value: number }[] };
};

type RawEffect = { id: number; name_ko: string; symbol?: string | null };

export type Effect = { name: string; value: string };

export type SupportDetail = {
  lane: "support";
  maxLevel: number;
  /** 최대 레벨 기준 효과 */
  effects: Effect[];
  /** 고유 효과. 조건부 효과는 수치를 정리할 수 없어서 hasConditional로만 알린다 */
  unique: { level: number; effects: Effect[]; hasConditional: boolean } | null;
  hintSkills: Skill[];
  eventSkills: Skill[];
};

/** R 40 · SR 45 · SSR 50 */
const MAX_LEVEL = [0, 40, 45, 50];
const LEVEL_STEPS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function formatEffect(value: number, symbol?: string | null) {
  return symbol === "percent" ? `${value}%` : `+${value}`;
}

// ── 공통 ──────────────────────────────────────────────

export type CardDetail = TrainDetail | SupportDetail;

export async function getCardDetail(lane: Lane, id: number): Promise<CardDetail | null> {
  try {
    if (lane === "train") {
      const [cards, skills, evoList] = await Promise.all([
        load<RawCharacterCard[]>("character-cards"),
        getSkills(),
        // 진화 정보가 없어도 나머지 상세는 보여 준다
        load<RawCardEvolutions[]>("evolutions").catch((err) => {
          logFailure("gametora 스킬 진화", err);
          return [];
        }),
      ]);
      const c = cards.find((x) => x.card_id === id);
      if (!c) return null;
      // 한국서버에 나온 카드는 한국서버에 열린 진화만. 일본서버에만 먼저 추가된 진화가 섞이지 않게 한다
      const evolutions: Record<number, Skill[]> = {};
      for (const e of evoList.find((x) => x.card_id === id)?.evolutions ?? []) {
        if (c.release_ko && e.servers && !e.servers.includes("ko")) continue;
        const evolved = skills.get(e.new);
        if (evolved) (evolutions[e.old] ??= []).push(evolved);
      }
      const byStar: [number, number[] | undefined][] = [
        [c.rarity, c.base_stats],
        [2, c.two_star_stats],
        [3, c.three_star_stats],
        [4, c.four_star_stats],
        [5, c.five_star_stats],
      ];
      return {
        lane,
        stats: byStar
          .filter((x): x is [number, number[]] => !!x[1] && x[0] >= c.rarity)
          .filter(([star], i, all) => all.findIndex(([s]) => s === star) === i)
          .map(([star, values]) => ({ star, values })),
        growth: c.stat_bonus,
        aptitude: c.aptitude,
        unique: pick(skills, c.skills_unique),
        innate: pick(skills, c.skills_innate),
        awakening: pick(skills, c.skills_awakening),
        event: pick(skills, c.skills_event),
        evolutions,
      };
    }
    const [cards, skills, effectDefs] = await Promise.all([
      load<RawSupportCard[]>("support-cards"),
      getSkills(),
      load<RawEffect[]>("support_effects"),
    ]);
    const s = cards.find((x) => x.support_id === id);
    if (!s) return null;
    const defs = new Map(effectDefs.map((e) => [e.id, e]));
    const maxLevel = MAX_LEVEL[s.rarity] ?? 50;
    const lastStep = LEVEL_STEPS.indexOf(maxLevel);
    const effects = s.effects.flatMap(([type, ...values]) => {
      const def = defs.get(type);
      const value = values.slice(0, lastStep + 1).filter((v) => v !== -1).at(-1);
      return def && value !== undefined && value > 0 ? [{ name: def.name_ko, value: formatEffect(value, def.symbol) }] : [];
    });
    const unique = s.unique
      ? {
          level: s.unique.level,
          effects: s.unique.effects.flatMap((e) => {
            const def = defs.get(e.type);
            return def ? [{ name: def.name_ko, value: formatEffect(e.value, def.symbol) }] : [];
          }),
          hasConditional: s.unique.effects.some((e) => !defs.has(e.type)),
        }
      : null;
    return {
      lane,
      maxLevel,
      effects,
      unique,
      hintSkills: pick(skills, s.hints?.hint_skills),
      eventSkills: pick(skills, s.event_skills),
    };
  } catch (err) {
    logFailure("gametora 카드 상세", err);
    return null;
  }
}
