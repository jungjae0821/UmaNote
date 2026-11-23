import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolCard } from "../lib/gachaPool.ts";
import { buildOdds, draw, toTable } from "../lib/gachaDraw.ts";

const card = (id: number, rarity: number, weight: number): PoolCard => ({
  id,
  name: String(id),
  title: "",
  rarity,
  weight,
  pickup: false,
  art: "",
});

// 실제 육성 배너와 같은 합: ★3 3%, ★2 18%, ★1 79% (0.0001% 단위)
const pool = [card(1, 3, 30_000), card(2, 2, 90_000), card(3, 2, 90_000), card(4, 1, 790_000)];

test("draw는 누적 확률 구간대로 카드를 고른다", () => {
  const t = toTable(pool, (c) => c.weight);
  assert.equal(draw(t, 0).id, 1);
  assert.equal(draw(t, 0.0299).id, 1);
  assert.equal(draw(t, 0.03).id, 2);
  assert.equal(draw(t, 0.12).id, 3);
  assert.equal(draw(t, 0.21).id, 4);
  assert.equal(draw(t, 0.9999).id, 4);
});

test("10번째 칸은 ★1 확률을 ★2로 옮긴다", () => {
  const { sums, lastSums, last } = buildOdds(pool);
  assert.deepEqual(sums.slice(1), [790_000, 180_000, 30_000]);
  assert.deepEqual(lastSums.slice(1), [0, 970_000, 30_000]);
  for (let r = 0; r < 1; r += 0.01) assert.notEqual(draw(last, r).rarity, 1);
});

test("★2가 없는 배너는 10번째 칸 표와 실제 뽑기가 모두 일반 확률이다", () => {
  const noStar2 = [card(1, 3, 30_000), card(4, 1, 970_000)];
  const { normal, last, sums, lastSums } = buildOdds(noStar2);
  assert.equal(last, normal);
  assert.deepEqual(lastSums, sums);
  assert.equal(draw(last, 0.5).rarity, 1);
});
