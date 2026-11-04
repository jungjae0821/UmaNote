import type { PoolCard } from "./gachaPool";

export type Table = { cards: PoolCard[]; cum: number[]; total: number };

export function toTable(cards: PoolCard[], weightOf: (c: PoolCard) => number): Table {
  const cum: number[] = [];
  let total = 0;
  for (const c of cards) {
    total += weightOf(c);
    cum.push(total);
  }
  return { cards, cum, total };
}

/** r은 [0, 1) 난수. 테스트에서 고정값을 넣을 수 있게 받는다 */
export function draw(t: Table, r = Math.random()): PoolCard {
  const x = r * t.total;
  let lo = 0;
  let hi = t.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t.cum[mid] > x) hi = mid;
    else lo = mid + 1;
  }
  return t.cards[lo];
}

export type Odds = {
  /** 1–9번째 칸 */
  normal: Table;
  /** 10번째 칸 */
  last: Table;
  /** 레어도별 확률 합, 인덱스가 레어도 (0은 비움) */
  sums: number[];
  lastSums: number[];
};

// 10번째 칸: ★1 확률을 빼고 그만큼을 ★2 카드에 똑같이 나눠 더한다 (gametora 시뮬레이터와 같은 방식).
// ★2 카드가 없는 배너는 옮길 곳이 없어서 10번째 칸도 일반 확률 그대로다
export function buildOdds(pool: PoolCard[]): Odds {
  const sums = [0, 0, 0, 0];
  for (const c of pool) sums[c.rarity] += c.weight;
  const normal = toTable(pool, (c) => c.weight);
  const star2 = pool.filter((c) => c.rarity === 2).length;
  if (star2 === 0) return { normal, last: normal, sums, lastSums: sums };

  const bonus = sums[1] / star2;
  const last = toTable(pool, (c) => (c.rarity === 1 ? 0 : c.rarity === 2 ? c.weight + bonus : c.weight));
  return { normal, last, sums, lastSums: [0, 0, sums[2] + sums[1], sums[3]] };
}
