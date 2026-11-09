import assert from "node:assert/strict";
import { test } from "node:test";
import { formatFull, monthStart } from "../lib/dates.ts";
import {
  anniversaryName,
  g1RaceOf,
  isG1Mission,
  monthWeeks,
  nextStarts,
  statusOf,
  type GameEvent,
} from "../lib/eventCalendar.ts";

const nov = monthStart(2026, 11); // 2026-11-01은 일요일
const ev = (id: string, start: number, end: number): GameEvent => ({
  id,
  kind: "cm",
  name: id,
  detail: "",
  startKr: nov + start,
  endKr: nov + end,
});

test("달력은 그달 1일이 든 주의 일요일부터 마지막 날이 든 주까지 그린다", () => {
  const weeks = monthWeeks([], 2026, 11);
  assert.equal(formatFull(weeks[0].start), "2026.11.01");
  assert.equal(weeks.length, 5);
  const dec = monthWeeks([], 2026, 12); // 12-01은 화요일
  assert.equal(formatFull(dec[0].start), "2026.11.29");
});

test("주를 넘는 이벤트는 주마다 끊고, 이어지는 쪽을 표시한다", () => {
  const weeks = monthWeeks([ev("a", 4, 9)], 2026, 11);
  const [first, second] = [weeks[0].bars[0], weeks[1].bars[0]];
  assert.deepEqual([first.col, first.span, first.fromBefore, first.toAfter], [4, 3, false, true]);
  assert.deepEqual([second.col, second.span, second.fromBefore, second.toAfter], [0, 3, true, false]);
});

test("앞뒤 달 날짜 칸에는 막대를 그리지 않는다", () => {
  // 11월 마지막 주는 11-29(일)~12-05(토). 12월에만 열리는 이벤트는 빠지고, 달을 넘는 이벤트는 11-30에서 끊긴다
  const weeks = monthWeeks([ev("dec", 32, 34), ev("cross", 28, 33)], 2026, 11);
  const last = weeks[weeks.length - 1];
  assert.deepEqual(last.bars.map((b) => [b.event.id, b.col, b.span, b.toAfter]), [["cross", 0, 2, true]]);
  assert.equal(weeks.flatMap((w) => w.bars).some((b) => b.event.id === "dec"), false);
});

test("겹치는 이벤트는 다른 줄에, 겹치지 않으면 위 줄을 다시 쓴다", () => {
  const week = monthWeeks([ev("a", 0, 2), ev("b", 1, 4), ev("c", 3, 5)], 2026, 11)[0];
  const lane = Object.fromEntries(week.bars.map((b) => [b.event.id, b.lane]));
  assert.deepEqual(lane, { a: 0, b: 1, c: 0 });
  assert.equal(week.lanes, 2);
});

test("진행 중은 오늘을 포함한 남은 날, 시작 전은 시작까지 남은 날", () => {
  const e = ev("a", 5, 9);
  assert.deepEqual(statusOf(e, nov + 3), { state: "next", days: 2 });
  assert.deepEqual(statusOf(e, nov + 9), { state: "live", days: 1 });
  assert.deepEqual(statusOf(e, nov + 10), { state: "done", days: 0 });
});

test("다음 시작은 오늘 이후 가장 이른 날에 시작하는 이벤트를 모두 고른다", () => {
  const list = [ev("a", 0, 9), ev("b", 5, 6), ev("c", 5, 8), ev("d", 7, 8)];
  assert.deepEqual(nextStarts(list, nov + 1).map((e) => e.id), ["c", "b"]);
  assert.deepEqual(nextStarts(list, nov + 8), []);
});

test("G1 기념 미션 이름에서 레이스 이름을 꺼낸다", () => {
  assert.equal(g1RaceOf("秋のGⅠ記念ミッション 第2弾 天皇賞（秋）"), "天皇賞（秋）");
  assert.equal(g1RaceOf("春のG1記念ミッション 第1弾(天皇賞（春）)"), "天皇賞（春）");
  assert.equal(g1RaceOf("春のG1記念ミッション第2弾(NHKマイル)"), "NHKマイル");
  assert.equal(g1RaceOf("GⅠ記念ミッション フェブラリーステークス"), "フェブラリーステークス");
  assert.equal(g1RaceOf("秋のGⅠ記念ミッション 第2弾 JBC2025"), "JBC 2025");
  assert.equal(isG1Mission("5th Anniversary 記念ミッション 第1弾"), false);
});

test("주년 기념 미션 이름을 한국어로 바꾼다", () => {
  assert.equal(anniversaryName("4.5th Anniversary 記念ミッション 第2弾"), "4.5주년 기념 미션 2탄");
  assert.equal(anniversaryName("Half Anniversary記念ミッション 第3弾"), "하프 애니버서리 기념 미션 3탄");
  assert.equal(anniversaryName("新育成シナリオ公開記念ミッション"), null);
});
