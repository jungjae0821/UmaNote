// 서버에서 클라이언트 화면으로 넘기는 가벼운 배너 모양
import type { Banner, Lane, SupportType } from "./gametora";

export type ViewCard = { id: number; lane: Lane; name: string; title: string; art: string; rarity: number; supportType?: SupportType };

export type ViewBanner = {
  id: number;
  lane: Lane;
  start: number;
  end: number;
  startTs: number;
  endTs: number;
  art: string | null;
  paidOnly: boolean;
  star3Up: boolean;
  estimated: boolean;
  pickups: (ViewCard & { rate: number; isNew: boolean })[];
};

export function toViewBanner(b: Banner): ViewBanner {
  return {
    id: b.id,
    lane: b.lane,
    start: b.start,
    end: b.end,
    startTs: b.startTs,
    endTs: b.endTs,
    art: b.art,
    paidOnly: b.paidOnly,
    star3Up: b.star3Up,
    estimated: b.estimated,
    pickups: b.pickups.map((p) => ({
      id: p.card.id,
      lane: p.card.lane,
      name: p.card.name,
      title: p.card.title,
      art: p.card.art,
      rarity: p.card.rarity,
      supportType: p.card.supportType,
      rate: p.rate,
      isNew: p.isNew,
    })),
  };
}

/** 픽업 이름을 한 번씩만 이어 붙인다. 많으면 "외 n명" */
export function pickupLabel(b: ViewBanner, max = 3): string {
  const names = [...new Set(b.pickups.map((p) => p.name))];
  if (names.length === 0) return b.paidOnly ? "유료 쥬얼 전용 가챠" : "픽업 정보 없음";
  return names.length > max ? `${names.slice(0, max).join(", ")} 외 ${names.length - max}명` : names.join(", ");
}
