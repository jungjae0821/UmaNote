import { cardArtUrl } from "./art";
import { dayFromTimestamp, jpToKr, krToJp } from "./dates";
import { fetchJson, logFailure } from "./fetchJson";
import { getKoLookup, getPaidOnlyIds, getStar3Limited, type KoLookup } from "./gametora";

const API = "https://umapyoi.net/api/v1";
const REVALIDATE = 3600;
// 상시 가챠는 end_date가 2147483647로 들어온다
const PERMANENT_END = 2_000_000_000;
// 정규 픽업 배너(3: 육성·서포트, 12: 서포트). 그 외 타입은 장기·특수 배너라 홈 노선도에서 뺀다
const REGULAR_PICKUP_TYPES = new Set([3, 12]);
// 상세 요청을 한 번에 이만큼까지만 보낸다
const DETAIL_LIMIT = 24;
// 이보다 긴 특수 배너는 몇 달씩 걸쳐 있는 상설에 가까운 배너라 일정표에서 뺀다
const SPECIAL_MAX_DAYS = 45;

type GachaSummary = {
  id: number;
  card_type: string;
  start_date: number;
  end_date: number;
  type: number;
};

type RawPickup = {
  /** 육성이면 의상 ID, 서포트면 서포트 카드 ID */
  id: number;
  chara_id?: number;
  title?: string;
  title_en?: string;
  rarity_string?: string;
  /** 서포트 카드 타입 (Speed, Stamina, ...) */
  type?: string;
  type_icon_url?: string;
  chara_data?: { name_en: string; name_jp: string; color_main: string; thumb_img: string };
};

export type Lane = "train" | "support";

export type Pickup = {
  id: number;
  name: string;
  title: string;
  rarity: string | null;
  /** 서포트 카드 타입 아이콘과 이름. 육성은 없음 */
  supportType: { icon: string; label: string } | null;
  /** 이 의상·카드의 일러스트 (gametora) */
  art: string;
  /** 일러스트가 없을 때 쓰는 캐릭터 기본 초상 (umapyoi) */
  thumb: string;
};

export type Gacha = {
  id: number;
  lane: Lane;
  /** pickup: 정규 픽업 배너, special: 그 외 기간 한정 배너 */
  kind: "pickup" | "special";
  /** 유료 쥬얼로만 돌릴 수 있는 배너 (gametora 기준) */
  paidOnly: boolean;
  /** 한국서버 예상일(일 번호) */
  startKr: number;
  endKr: number;
  startJp: number;
  endJp: number;
  pickups: Pickup[];
};

const getJson = <T>(path: string) => fetchJson<T>(`${API}${path}`, REVALIDATE);

const SUPPORT_TYPE_KO: Record<string, string> = {
  Speed: "스피드",
  Stamina: "스태미나",
  Power: "파워",
  Guts: "근성",
  Wisdom: "지능",
  Friend: "친구",
  Group: "그룹",
};

function supportType(p: RawPickup): Pickup["supportType"] {
  if (!p.type_icon_url || !p.type) return null;
  return { icon: p.type_icon_url, label: SUPPORT_TYPE_KO[p.type] ?? p.type };
}

// 이름·카드 제목은 gametora에 한국어가 있으면 그것을, 없으면 일본어 원문을 쓴다
function toPickup(lane: Lane, p: RawPickup, ko: KoLookup): Pickup | null {
  if (!p.chara_data) return null;
  const { name_jp, thumb_img } = p.chara_data;
  const card = (lane === "support" ? ko.support : ko.outfit).get(p.id);
  const charaKo = p.chara_id === undefined ? undefined : ko.chara.get(p.chara_id);
  return {
    id: p.id,
    name: card?.name || charaKo || name_jp,
    title: card?.title || p.title || p.title_en || "",
    rarity: p.rarity_string ?? null,
    supportType: lane === "support" ? supportType(p) : null,
    art: cardArtUrl(lane, p.id, p.chara_id) ?? thumb_img,
    thumb: thumb_img,
  };
}

// umapyoi 픽업 목록에 없는 ★3 한정 카드는 gametora 카드 정보로 만든다. 기본 초상이 없어 일러스트를 그대로 대체로 쓴다
function gametoraPickup(id: number, ko: KoLookup): Pickup | null {
  const card = ko.outfitCard.get(id);
  if (!card) return null;
  const text = ko.outfit.get(id);
  const art = cardArtUrl("train", id, card.charaId) as string;
  return {
    id,
    name: text?.name || ko.chara.get(card.charaId) || card.nameJp || "",
    title: text?.title || card.titleJp || "",
    rarity: null,
    supportType: null,
    art,
    thumb: art,
  };
}

type RangeOptions = {
  /** 정규 픽업 외 기간 한정 배너도 넣는다 */
  special?: boolean;
  limit?: number;
};

/** 가챠 ID → 공지용 배너 이미지. 초기 가챠는 이미지가 없어서 빠진다. 실패하면 빈 표 */
export async function getGachaImages(): Promise<Map<number, string>> {
  try {
    const list = await getJson<(GachaSummary & { image_url: string | null })[]>("/gacha");
    return new Map(list.flatMap((g) => (g.image_url ? [[g.id, g.image_url] as const] : [])));
  } catch (err) {
    logFailure("umapyoi 배너 이미지", err);
    return new Map();
  }
}

/** 기간 한정 가챠가 있는 한국서버 날짜 범위 (가장 이른 시작일, 가장 늦은 시작일) */
export async function getGachaSpan(): Promise<{ firstKr: number; lastKr: number }> {
  const list = await getJson<GachaSummary[]>("/gacha");
  const starts = list.filter((g) => g.end_date < PERMANENT_END).map((g) => dayFromTimestamp(g.start_date));
  // 빈 목록이면 Math.min()이 Infinity가 되어 달 계산이 깨지므로 불러오기 실패로 다룬다
  if (starts.length === 0) throw new Error("umapyoi /gacha: 기간 한정 가챠 없음");
  return { firstKr: jpToKr(Math.min(...starts)), lastKr: jpToKr(Math.max(...starts)) };
}

/** 한국서버 날짜 범위 [fromKr, toKr]에 걸치는 픽업 가챠를 시작일 순으로 */
export async function getGachasBetween(
  fromKr: number,
  toKr: number,
  { special = false, limit = DETAIL_LIMIT }: RangeOptions = {},
): Promise<Gacha[]> {
  const fromJp = krToJp(fromKr);
  const toJp = krToJp(toKr);
  const [list, ko] = await Promise.all([getJson<GachaSummary[]>("/gacha"), getKoLookup()]);
  const [star3Limited, paidOnly] = await Promise.all([getStar3Limited(ko.outfitCard), getPaidOnlyIds()]);

  const inRange = list.filter((g) => {
    if (g.end_date >= PERMANENT_END) return false;
    const s = dayFromTimestamp(g.start_date);
    const e = dayFromTimestamp(g.end_date);
    if (!REGULAR_PICKUP_TYPES.has(g.type) && (!special || e - s > SPECIAL_MAX_DAYS)) return false;
    return s <= toJp && e >= fromJp;
  });
  inRange.sort((a, b) => a.start_date - b.start_date || a.id - b.id);

  const details = await Promise.all(
    inRange.slice(0, limit).map((g) =>
      getJson<GachaSummary & { pickups?: RawPickup[] }>(`/gacha/${g.id}`).catch((err) => {
        logFailure(`umapyoi 가챠 ${g.id} 상세`, err);
        return null;
      }),
    ),
  );

  return details
    .flatMap((g): Gacha[] => {
      if (!g) return [];
      const lane: Lane = g.card_type === "Support Card" ? "support" : "train";
      const pickups = (g.pickups ?? []).map((p) => toPickup(lane, p, ko)).filter((p): p is Pickup => p !== null);
      const limitedIds = lane === "train" ? star3Limited.get(g.id) : undefined;
      for (const id of limitedIds ?? []) {
        if (pickups.some((p) => p.id === id)) continue;
        const extra = gametoraPickup(id, ko);
        if (extra) pickups.push(extra);
      }
      if (pickups.length === 0) return [];
      const startJp = dayFromTimestamp(g.start_date);
      const endJp = dayFromTimestamp(g.end_date);
      return [
        {
          id: g.id,
          lane,
          kind: REGULAR_PICKUP_TYPES.has(g.type) ? "pickup" : "special",
          paidOnly: paidOnly.has(g.id),
          startJp,
          endJp,
          startKr: jpToKr(startJp),
          endKr: jpToKr(endJp),
          pickups,
        },
      ];
    })
    .sort((a, b) => a.startKr - b.startKr || a.id - b.id);
}
