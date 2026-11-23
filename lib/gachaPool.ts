import type { Banner, Card, Lane, SupportType } from "./gametora";

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
  supportType?: SupportType;
};

/** 배너의 lineup을 카드별 확률 목록으로. ★ 높은 순, 픽업 먼저 */
export function buildPool(banner: Banner, get: (lane: Lane, id: number) => Card | undefined): PoolCard[] {
  const pickupIds = new Set(banner.pickups.map((p) => p.card.id));
  const pool = Object.entries(banner.lineup).flatMap(([weight, ids]) =>
    ids.flatMap((id): PoolCard[] => {
      const c = get(banner.lane, id);
      return c ? [{ id, name: c.name, title: c.title, rarity: c.rarity, weight: Number(weight), pickup: pickupIds.has(id), art: c.art, supportType: c.supportType }] : [];
    }),
  );
  return pool.sort((a, b) => b.rarity - a.rarity || Number(b.pickup) - Number(a.pickup) || b.weight - a.weight || a.id - b.id);
}

/** 7500 → "0.75%" */
export function formatRate(weight: number): string {
  return `${(weight / 10_000).toFixed(weight % 100 === 0 ? 2 : 3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}
