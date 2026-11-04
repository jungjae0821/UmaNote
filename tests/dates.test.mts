import assert from "node:assert/strict";
import { test } from "node:test";
import { dayFromTimestamp, formatDday, formatFull, jpToKr, krToJp, monthOf, monthStart } from "../lib/dates.ts";

test("UTC+9 자정을 기준으로 날이 바뀐다", () => {
  // 2025-07-16 00:00 KST = 2025-07-15 15:00 UTC
  const midnight = Date.UTC(2025, 6, 15, 15) / 1000;
  assert.equal(formatFull(dayFromTimestamp(midnight)), "2025.07.16");
  assert.equal(formatFull(dayFromTimestamp(midnight - 1)), "2025.07.15");
});

test("일본서버 날짜에 476일을 더하면 한국서버 예상일", () => {
  const jp = monthStart(2025, 7) + 15; // 2025.07.16
  assert.equal(formatFull(jpToKr(jp)), "2026.11.04");
  assert.equal(krToJp(jpToKr(jp)), jp);
});

test("monthStart는 13월을 다음 해 1월로 넘긴다", () => {
  assert.deepEqual(monthOf(monthStart(2026, 13)), { y: 2027, m: 1 });
});

test("D-day 표기", () => {
  assert.equal(formatDday(0), "D-Day");
  assert.equal(formatDday(6), "D-6");
  assert.equal(formatDday(-2), "D+2");
});
