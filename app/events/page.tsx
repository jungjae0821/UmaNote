import Link from "next/link";
import type { CSSProperties } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { formatDday, formatFull, formatShort, krToJp, monthOf, monthStart, todayKr, weekday } from "@/lib/dates";
import {
  GROUPS,
  groupOf,
  KINDS,
  monthWeeks,
  nextStarts,
  overlapping,
  statusOf,
  type EventGroup,
  type GameEvent,
} from "@/lib/eventCalendar";
import { getEventSchedule, type EventSchedule } from "@/lib/events";
import { logFailure } from "@/lib/fetchJson";

export const metadata = { title: "이벤트 일정 | 우마노트" };
export const revalidate = 3600;

type Filter = "all" | EventGroup;
type Month = { y: number; m: number };
type Props = { searchParams: Promise<{ month?: string; group?: string }> };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function parseMonth(raw: string | undefined, today: number): Month {
  const match = raw?.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m >= 1 && m <= 12) return { y, m };
  }
  return monthOf(today);
}

const monthKey = ({ y, m }: Month) => `${y}-${String(m).padStart(2, "0")}`;

function shift({ y, m }: Month, by: number): Month {
  const i = y * 12 + (m - 1) + by;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

function href(month: Month, filter: Filter) {
  const q = new URLSearchParams({ month: monthKey(month) });
  if (filter !== "all") q.set("group", filter);
  return `/events?${q}`;
}

const title = (e: GameEvent) => (e.name ? `${KINDS[e.kind].label} ${e.name}` : KINDS[e.kind].label);
const dayLabel = (day: number) => `${formatShort(day)} (${weekday(day)})`;

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = todayKr();
  const filter: Filter = GROUPS.some((g) => g.value === params.group) ? (params.group as EventGroup) : "all";

  let schedule: EventSchedule | null;
  try {
    schedule = await getEventSchedule();
  } catch (err) {
    logFailure("gametora 이벤트 일정", err);
    schedule = null;
  }

  if (schedule === null || schedule.events.length === 0) {
    return (
      <main className="page ev">
        <h1 className="ev-h1">이벤트 일정</h1>
        <div className="notice" role="alert">
          <b>이벤트 일정을 불러오지 못했어요.</b>
          <p>gametora.com에서 응답이 오지 않았어요. 잠시 뒤 새로고침해 주세요.</p>
        </div>
      </main>
    );
  }

  const all = schedule.events;
  const events = filter === "all" ? all : all.filter((e) => groupOf(e) === filter);
  const first = monthOf(Math.min(...all.map((e) => e.startKr)));
  const last = monthOf(Math.max(...all.map((e) => e.endKr)));

  // 데이터가 있는 달 바깥으로는 가지 않는다
  let month = parseMonth(params.month, today);
  if (monthKey(month) < monthKey(first)) month = first;
  if (monthKey(month) > monthKey(last)) month = last;
  const from = monthStart(month.y, month.m);
  const to = monthStart(shift(month, 1).y, shift(month, 1).m) - 1;
  const prev = shift(month, -1);
  const next = shift(month, 1);
  const thisMonth = monthOf(today);
  const inMonth = overlapping(events, from, to);

  return (
    <main className="page ev">
      <div className="ev-head">
        <h1 className="ev-h1">이벤트 일정</h1>
        <NextUp events={events} today={today} />
      </div>

      <nav className="seg ev-groups" aria-label="이벤트 종류">
        <Link href={href(month, "all")} aria-current={filter === "all" ? "true" : undefined}>
          <i className="ev-none" aria-hidden="true" />
          전체
        </Link>
        {GROUPS.map((g) => (
          <Link
            key={g.value}
            href={href(month, g.value)}
            aria-current={filter === g.value ? "true" : undefined}
            className={`ev-${g.value}`}
          >
            <i aria-hidden="true" />
            {g.label}
          </Link>
        ))}
      </nav>

      <nav className="month-nav" aria-label="달 이동">
        {monthKey(month) > monthKey(first) ? (
          <Link href={href(prev, filter)} className="month-step" aria-label={`${prev.y}년 ${prev.m}월`}>
            ‹ {prev.m}월
          </Link>
        ) : (
          <span className="month-step" aria-hidden="true" />
        )}
        <h2 className="month-title">
          <MonthPicker
            month={month}
            first={first}
            last={last}
            thisMonth={thisMonth}
            hrefBase={filter === "all" ? "" : `group=${filter}`}
            path="/events"
          />
          <small>
            일본 {formatFull(krToJp(from))} – {formatShort(krToJp(to))}
          </small>
        </h2>
        {monthKey(month) < monthKey(last) ? (
          <Link href={href(next, filter)} className="month-step month-next" aria-label={`${next.y}년 ${next.m}월`}>
            {next.m}월 ›
          </Link>
        ) : (
          <span className="month-step" aria-hidden="true" />
        )}
        {monthKey(month) !== monthKey(thisMonth) && (
          <Link href={href(thisMonth, filter)} className="month-now">
            이번 달로
          </Link>
        )}
      </nav>

      {inMonth.length === 0 ? (
        <p className="notice">
          {month.m}월에 열리는 {filter === "all" ? "" : `${GROUPS.find((g) => g.value === filter)!.label} `}이벤트가
          없어요. 다른 달이나 종류를 골라 보세요.
        </p>
      ) : (
        <>
          <MonthGrid events={events} month={month} today={today} />
          <EventList events={inMonth} month={month} today={today} />
        </>
      )}

      <p className="sched-note">
        gametora.com의 일본서버 일정에 476일을 더한 날짜예요. 마스터즈 챌린지는 개최 날짜가 정리된 자료를 찾지 못해
        넣지 않았어요.
        {schedule.failed.length > 0 &&
          ` 이번에는 ${schedule.failed.map((k) => KINDS[k].label).join(", ")} 일정을 불러오지 못했어요.`}
      </p>
    </main>
  );
}

function NextUp({ events, today }: { events: GameEvent[]; today: number }) {
  const next = nextStarts(events, today);
  if (next.length === 0) return null;
  const day = next[0].startKr;
  return (
    <p className="ev-next">
      <span className="ev-next-label">다음 시작</span>
      <b className="ev-next-date">{dayLabel(day)}</b>
      <span className="ev-next-names">
        {title(next[0])}
        {next.length > 1 && ` 외 ${next.length - 1}개`}
      </span>
      <span className="ev-dday">{formatDday(day - today)}</span>
    </p>
  );
}

type GridProps = { events: GameEvent[]; month: Month; today: number };

// 아래 목록과 같은 내용을 그림으로 보여주는 판이라 읽기 도구에서는 목록만 읽게 한다
function MonthGrid({ events, month, today }: GridProps) {
  const weeks = monthWeeks(events, month.y, month.m);
  return (
    <section className="ev-cal" aria-hidden="true">
      <div className="ev-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <ol className="ev-weeks">
        {weeks.map((w) => (
          // repeat(0, …)은 잘못된 값이라 줄 선언 전체가 무시되므로 막대 줄을 최소 1줄 둔다
          <li key={w.start} className="ev-week" style={{ "--lanes": Math.max(1, w.lanes) } as CSSProperties}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = w.start + i;
              const { m } = monthOf(day);
              const date = day - monthStart(monthOf(day).y, m) + 1;
              const cls = ["ev-day", m !== month.m && "is-out", day === today && "is-today"].filter(Boolean).join(" ");
              return (
                <span key={day} className={cls} style={{ gridColumn: i + 1 }}>
                  <b>{date}</b>
                  {day === today && <span className="ev-today">오늘</span>}
                </span>
              );
            })}
            {w.bars.map((b) => (
              <span
                key={b.event.id}
                className={[
                  "ev-bar",
                  `ev-${groupOf(b.event)}`,
                  b.fromBefore && "from-before",
                  b.toAfter && "to-after",
                  b.event.endKr < today && "is-done",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.lane + 2 }}
                title={`${title(b.event)} · ${dayLabel(b.event.startKr)} – ${dayLabel(b.event.endKr)}`}
              >
                {/* 두 칸 이하 막대는 종류 이름이 자리를 다 차지하므로 이벤트 이름만 쓴다. 종류는 막대 색과 title에 남는다 */}
                {(b.span > 2 || !b.event.name) && <em>{KINDS[b.event.kind].label}</em>}
                {b.event.name}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}

function EventList({ events, month, today }: GridProps) {
  return (
    <section className="ev-list" aria-labelledby="ev-list-title">
      <h2 id="ev-list-title">
        {month.m}월에 열리는 이벤트 <span>{events.length}개</span>
      </h2>
      <ul>
        {events.map((e) => {
          const s = statusOf(e, today);
          return (
            <li key={e.id} className={`ev-item ev-${groupOf(e)}${s.state === "done" ? " is-done" : ""}`}>
              <i aria-hidden="true" />
              <div className="ev-item-text">
                <span className="ev-kind">{KINDS[e.kind].label}</span>
                {e.name && <b>{e.name}</b>}
                {e.detail && <span className="ev-detail">{e.detail}</span>}
              </div>
              <div className="ev-dates">
                <span>
                  {dayLabel(e.startKr)} – {dayLabel(e.endKr)}
                </span>
                <small>
                  일본 {formatFull(krToJp(e.startKr))} – {formatShort(krToJp(e.endKr))}
                </small>
              </div>
              <span className={`ev-status is-${s.state}`}>
                {s.state === "live" ? `${s.days}일 남음` : s.state === "next" ? formatDday(s.days) : "끝남"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
