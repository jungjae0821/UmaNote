import { cardArtUrl, gachaBannerUrl } from "./art";
import { dayFromTimestamp, jpToKr, krToJp } from "./dates";
import { getKoLookup, getStandardBanners, type KoLookup, type RawBanner } from "./gametora";
import { getGachaImages, type Lane } from "./umapyoi";
const LABEL_NAMES = 3;

export type BannerOption = {
  id: number;
  startKr: number;
  endKr: number;
  startJp: number;
  endJp: number;
  /** 픽업 카드 이름을 이어 붙인 것 */
  label: string;
};

export type PoolCard = {
  id: number;
  name: string;
  title: string;
  /** 1–3. 육성은 ★, 서포트는 R·SR·SSR */
  rarity: number;
  /** 한 번 뽑을 때 이 카드가 나올 확률, 0.0001% 단위 (7500 = 0.75%) */
  weight: number;
  pickup: boolean;
  art: string;
};

export type BannerImage = {
  /** umapyoi의 공지용 배너 이미지. 서비스 초기 배너는 없다 */
  src: string | null;
  /** gametora의 게임 내 배너 이미지. 모든 배너에 있어서 대체로 쓴다 */
  fallback: string;
};

export type SimData = {
  banners: BannerOption[];
  selected: BannerOption;
  image: BannerImage;
  pool: PoolCard[];
};

function card(lane: Lane, id: number, ko: KoLookup) {
  const meta = (lane === "train" ? ko.outfitCard : ko.supportCard).get(id);
  if (!meta) return null;
  const text = (lane === "train" ? ko.outfit : ko.support).get(id);
  return {
    rarity: meta.rarity,
    name: text?.name || ko.chara.get(meta.charaId) || meta.nameJp || String(id),
    title: text?.title || meta.titleJp || "",
    // 카드 정보가 있으면 캐릭터 ID도 있어서 주소가 늘 만들어진다
    art: cardArtUrl(lane, id, meta.charaId) as string,
  };
}

function option(b: RawBanner, lane: Lane, ko: KoLookup): BannerOption {
  const startJp = dayFromTimestamp(b.start);
  const endJp = dayFromTimestamp(b.end);
  // 복각 모음 배너는 픽업이 수십 장이고 같은 캐릭터가 여러 번 나와서, 이름을 한 번씩만 세 명까지 적는다
  const names = [
    ...new Set((b.pickups ?? []).map(([id]) => card(lane, id, ko)?.name).filter((n): n is string => !!n)),
  ];
  const label =
    names.length === 0
      ? "픽업 없음"
      : names.length > LABEL_NAMES
        ? `${names.slice(0, LABEL_NAMES).join(", ")} 외 ${names.length - LABEL_NAMES}명`
        : names.join(", ");
  return {
    id: b.id,
    startJp,
    endJp,
    startKr: jpToKr(startJp),
    endKr: jpToKr(endJp),
    label,
  };
}

/**
 * 시뮬레이터용 배너 목록(최신순)과 고른 배너의 카드별 확률.
 * bannerId가 없거나 목록에 없으면 한국서버 오늘 진행 중인 배너, 없으면 가장 최근에 시작한 배너를 고른다.
 */
export async function getSimData(lane: Lane, bannerId: number | null, todayKr: number): Promise<SimData> {
  const [raw, ko, images] = await Promise.all([
    getStandardBanners(lane === "train" ? "char" : "support"),
    getKoLookup(),
    getGachaImages(),
  ]);
  const sorted = raw.slice().sort((a, b) => b.start - a.start || b.id - a.id);
  const banners = sorted.map((b) => option(b, lane, ko));

  const todayJp = krToJp(todayKr);
  let index = banners.findIndex((b) => b.id === bannerId);
  if (index === -1) index = banners.findIndex((b) => b.startJp <= todayJp && todayJp <= b.endJp);
  if (index === -1) index = banners.findIndex((b) => b.startJp <= todayJp);
  if (index === -1) index = banners.length - 1;

  const banner = sorted[index];
  const pickupIds = new Set((banner.pickups ?? []).map(([id]) => id));
  const pool = Object.entries(banner.lineup).flatMap(([weight, ids]) =>
    ids.flatMap((id): PoolCard[] => {
      const c = card(lane, id, ko);
      return c ? [{ id, ...c, weight: Number(weight), pickup: pickupIds.has(id) }] : [];
    }),
  );
  pool.sort(
    (a, b) =>
      b.rarity - a.rarity || Number(b.pickup) - Number(a.pickup) || b.weight - a.weight || a.id - b.id,
  );
  const image = {
    src: images.get(banner.id) ?? null,
    fallback: gachaBannerUrl(banner.id),
  };
  return { banners, selected: banners[index], image, pool };
}
