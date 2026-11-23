"use client";

import { useState } from "react";
import { dayOfMonth, formatDday, monthOf, monthStart, weekdayIndex } from "@/lib/dates";
import "./birthdays.css";

export type BdChar = { charId: number; name: string; month: number; day: number; icon: string; art: string };
type Next = BdChar & { until: number };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = [1, 2, 3, 4, 5, 6];

export function BirthdaysView({ list, next, today }: { list: BdChar[]; next: Next[]; today: number }) {
  const now = monthOf(today);
  const firstNext = next[0];
  // 다음 생일이 있는 달을 먼저 연다 (1~6월 밖이면 1월)
  const [month, setMonth] = useState(firstNext ? firstNext.month : now.m >= 1 && now.m <= 6 ? now.m : 1);
  // 다음 생일이 오는 해의 달력을 그린다
  const year = firstNext && firstNext.month < now.m ? now.y + 1 : now.m <= 6 ? now.y : now.y + 1;

  const first = monthStart(year, month);
  const last = monthStart(year, month + 1) - 1;
  const gridStart = first - weekdayIndex(first);
  const days: number[] = [];
  for (let d = gridStart; d <= last || days.length % 7 !== 0; d++) days.push(d);
  const byDay = new Map<number, BdChar[]>();
  for (const c of list.filter((c) => c.month === month)) byDay.set(c.day, [...(byDay.get(c.day) ?? []), c]);

  return (
    <div className="stack">
      {firstNext && (
        <section>
          <h2 className="section-title">다음 생일</h2>
          <div className="bd-next">
          <article className="bd-hero glass">
            <img className="bd-hero-art" src={firstNext.art} alt="" />
            <div className="bd-hero-body">
              <h3>{firstNext.name}</h3>
              <p className="bd-hero-date">
                {firstNext.month}월 {firstNext.day}일
              </p>
              <p className="bd-dday">{formatDday(firstNext.until)}</p>
            </div>
          </article>
          <ol className="bd-after panel glass">
            {next.slice(1).map((b) => (
              <li key={b.charId}>
                <img src={b.icon} alt="" loading="lazy" />
                <span>
                  <b>{b.name}</b>
                  <small>
                    {b.month}월 {b.day}일
                  </small>
                </span>
                <span className="chip">
                  <i aria-hidden />
                  {formatDday(b.until)}
                </span>
              </li>
            ))}
          </ol>
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">달별 생일</h2>
        <div className="bd-tabs seg" role="tablist" aria-label="달">
          {MONTHS.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={month === m} onClick={() => setMonth(m)}>
              {m}월
            </button>
          ))}
        </div>
        <div className="bd-cal glass" role="grid" aria-label={`${year}년 ${month}월 생일`}>
          <div className="bd-head" role="row">
            {WEEKDAYS.map((w) => (
              <span key={w} role="columnheader">
                {w}
              </span>
            ))}
          </div>
          <div className="bd-grid">
            {days.map((d) => {
              const out = d < first || d > last;
              const people = out ? [] : byDay.get(dayOfMonth(d)) ?? [];
              return (
                <div key={d} role="gridcell" className={`bd-cell${out ? " out" : ""}${d === today ? " today" : ""}`}>
                  <span className="bd-num">{dayOfMonth(d)}</span>
                  {people.map((p) => (
                    <span key={p.charId} className="bd-person">
                      <img src={p.icon} alt="" loading="lazy" />
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
