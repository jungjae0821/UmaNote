import assert from "node:assert/strict";
import { test } from "node:test";
import { accrue, gameDay } from "../lib/dailyReset.ts";

// 한국 시간을 ms로
const kst = (iso: string) => Date.parse(`${iso}+09:00`);

test("05:00 전까지는 전날 게임 날짜다", () => {
  assert.equal(gameDay(kst("2026-11-25T04:59:59")), gameDay(kst("2026-11-24T05:00:00")));
  assert.equal(gameDay(kst("2026-11-25T05:00:00")), gameDay(kst("2026-11-24T05:00:00")) + 1);
});

test("같은 게임 날짜 안에서는 더하지 않는다", () => {
  assert.deepEqual(accrue(kst("2026-11-24T06:00:00"), kst("2026-11-25T04:30:00"), false), { days: 0, jewels: 0 });
});

test("초기화를 지날 때마다 데일리 50씩 더한다", () => {
  assert.deepEqual(accrue(kst("2026-11-24T23:00:00"), kst("2026-11-25T05:00:00"), false), { days: 1, jewels: 50 });
  assert.deepEqual(accrue(kst("2026-11-24T03:00:00"), kst("2026-11-27T12:00:00"), false), { days: 4, jewels: 200 });
});

test("월정액이면 하루 50을 더 받는다", () => {
  assert.deepEqual(accrue(kst("2026-11-24T10:00:00"), kst("2026-11-26T10:00:00"), true), { days: 2, jewels: 200 });
});

test("시계가 뒤로 가면 0", () => {
  assert.deepEqual(accrue(kst("2026-11-26T10:00:00"), kst("2026-11-24T10:00:00"), false), { days: 0, jewels: 0 });
});
