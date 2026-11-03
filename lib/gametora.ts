// gametora의 카드 데이터에서 한국어 이름·카드 제목을 가져온다.
// 파일 이름에 해시가 붙어 있어서 manifest로 현재 파일을 찾는다.
const BASE = "https://gametora.com/data";
const REVALIDATE = 86_400;

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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`gametora ${url} ${res.status}`);
  return res.json() as Promise<T>;
}

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
    for (const c of cards) {
      lookup.outfit.set(c.card_id, { name: c.name_ko, title: c.title_ko });
      lookup.outfitCard.set(c.card_id, { charaId: c.char_id, rarity: c.rarity, nameJp: c.name_jp, titleJp: c.title_jp });
      if (c.name_ko) lookup.chara.set(c.char_id, c.name_ko);
    }
    for (const s of supports) {
      lookup.support.set(s.support_id, { name: s.name_ko, title: s.title_ko });
      lookup.supportCard.set(s.support_id, { charaId: s.char_id, rarity: s.rarity, nameJp: s.name_jp, titleJp: s.title_ja });
      if (s.name_ko && !lookup.chara.has(s.char_id)) lookup.chara.set(s.char_id, s.name_ko);
    }
  } catch {
    // 한국어가 없어도 화면은 일본어로 그대로 동작한다
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
  } catch {
    // 이 정보가 없어도 일정표는 그대로 동작한다
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
  } catch {
    return new Set();
  }
}
