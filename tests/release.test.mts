import assert from "node:assert/strict";
import { test } from "node:test";
import type { Banner, Card } from "../lib/gametora.ts";
import { krRelease, releaseState } from "../lib/release.ts";

const card = (releaseKr: number | null): Card => ({
  lane: "train",
  id: 1,
  charId: 1,
  name: "",
  title: "",
  rarity: 3,
  art: "",
  releaseKr,
  releaseJp: null,
  obtained: "gacha",
  urlName: "",
});

const banner = (start: number, end: number, estimated = false): Banner =>
  ({ lane: "train", start, end, estimated, pickups: [{ card: card(null), rate: 0, isNew: true }] }) as unknown as Banner;

test("출시일 전에는 예정, 출시일부터 첫 픽업 끝날 때까지 신규, 그 뒤엔 출시", () => {
  const r = krRelease(card(100), [banner(100, 110)]);
  assert.equal(releaseState(r, 99), "upcoming");
  assert.equal(releaseState(r, 100), "new");
  assert.equal(releaseState(r, 110), "new");
  assert.equal(releaseState(r, 111), "released");
});

test("gametora release_ko가 비어 있어도 가챠 일정이 시작되면 신규", () => {
  const r = krRelease(card(null), [banner(200, 210, true)]);
  assert.equal(r.day, 200);
  assert.equal(r.estimated, true);
  assert.equal(releaseState(r, 199), "upcoming");
  assert.equal(releaseState(r, 200), "new");
});

test("픽업 배너 없는 카드는 출시 후 14일 동안 신규", () => {
  const r = krRelease(card(300), []);
  assert.equal(releaseState(r, 313), "new");
  assert.equal(releaseState(r, 314), "released");
});

test("일정이 전혀 없으면 예정", () => {
  assert.equal(releaseState(krRelease(card(null), []), 500), "upcoming");
});
