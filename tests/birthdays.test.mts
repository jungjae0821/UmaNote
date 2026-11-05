import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultMonth, isNpc, monthCells, nextBirthdays, yearFor, type Birthday } from "../lib/birthdayCalendar.ts";
import { formatFull, monthStart } from "../lib/dates.ts";
import { fixKo } from "../lib/koNameFallback.ts";

const b = (id: number, month: number, day: number): Birthday => ({ id, name: `${id}`, month, day, icon: "" });
const list = [b(1, 1, 1), b(2, 3, 10), b(3, 3, 10), b(4, 6, 30), b(5, 9, 1)];

test("범위 밖 달에는 다음 1월을 먼저 연다", () => {
  assert.equal(defaultMonth(monthStart(2026, 11) + 4), 1);
  assert.equal(defaultMonth(monthStart(2027, 3) + 4), 3);
});

test("이미 지난 달은 다음 해 달력으로 그린다", () => {
  const today = monthStart(2027, 3) + 4;
  assert.equal(yearFor(1, today), 2028);
  assert.equal(yearFor(3, today), 2027);
});

test("다음 생일은 해를 넘겨 찾고, 7월 이후 생일은 빼고, 같은 날 생일자를 모은다", () => {
  const nov = nextBirthdays(list, monthStart(2026, 11) + 4);
  assert.equal(formatFull(nov!.day), "2027.01.01");

  const mar = nextBirthdays(list, monthStart(2027, 3) + 9);
  assert.equal(formatFull(mar!.day), "2027.03.10");
  assert.deepEqual(mar!.people.map((p) => p.id), [2, 3]);

  const jul = nextBirthdays(list, monthStart(2027, 7));
  assert.equal(formatFull(jul!.day), "2028.01.01");
});

test("달력 앞 빈칸은 1일의 요일 수만큼", () => {
  // 2027-01-01은 금요일
  const jan = monthCells(list, 2027, 1);
  assert.equal(jan.lead, 5);
  assert.equal(jan.cells.length, 31);
  assert.deepEqual(jan.cells[0].people.map((p) => p.id), [1]);
  // 2028년은 윤년
  assert.equal(monthCells(list, 2028, 2).cells.length, 29);
});

test("나무위키 인덱스 기준 NPC는 빼고, ID가 없는 캐릭터는 남긴다", () => {
  assert.equal(isNpc(1001), false);
  assert.equal(isNpc(1139), true);
  assert.equal(isNpc(2001), true);
  assert.equal(isNpc(9040), true);
  assert.equal(isNpc(null), false);
});

test("gametora 표기 '베르시나'는 공식 표기 '비르시나'로 고친다", () => {
  assert.equal(fixKo("베르시나"), "비르시나");
  assert.equal(fixKo("[감청색 대관식] 베르시나"), "[감청색 대관식] 비르시나");
  assert.equal(fixKo("스페셜 위크"), "스페셜 위크");
  assert.equal(fixKo(undefined), undefined);
});
