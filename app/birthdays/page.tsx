import Link from "next/link";
import {
  defaultMonth,
  FIRST_MONTH,
  inRange,
  LAST_MONTH,
  monthCells,
  nextBirthdays,
  yearFor,
  type Birthday,
} from "@/lib/birthdayCalendar";
import { getBirthdays } from "@/lib/birthdays";
import { formatDday, todayKr, weekday } from "@/lib/dates";
import { logFailure } from "@/lib/fetchJson";

export const metadata = { title: "생일달력 | 우마노트" };
export const revalidate = 3600;

const MONTHS = Array.from({ length: LAST_MONTH - FIRST_MONTH + 1 }, (_, i) => FIRST_MONTH + i);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props = { searchParams: Promise<{ month?: string }> };

export default async function BirthdaysPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = todayKr();
  const asked = Number(params.month);
  const month = Number.isInteger(asked) && inRange(asked) ? asked : defaultMonth(today);
  const year = yearFor(month, today);

  let list: Birthday[] | null;
  try {
    list = await getBirthdays();
  } catch (err) {
    logFailure("umapyoi 생일 목록", err);
    list = null;
  }

  return (
    <main className="page bday">
      <h1 className="bday-h1">생일달력</h1>

      {list === null ? (
        <div className="notice" role="alert">
          <b>생일 목록을 불러오지 못했어요.</b>
          <p>umapyoi.net에서 응답이 오지 않았어요. 잠시 뒤 새로고침해 주세요.</p>
        </div>
      ) : (
        <>
          <div className="bday-bar">
            <nav className="seg bday-months" aria-label="달 고르기">
              {MONTHS.map((m) => {
                const count = list.filter((b) => b.month === m).length;
                return (
                  <Link
                    key={m}
                    href={`/birthdays?month=${m}`}
                    aria-current={m === month ? "true" : undefined}
                    aria-label={`${m}월, ${count}명`}
                  >
                    {m}월<span className="bday-count">{count}명</span>
                  </Link>
                );
              })}
            </nav>
            <NextUp list={list} today={today} />
          </div>
          <MonthGrid list={list} year={year} month={month} today={today} />
        </>
      )}
    </main>
  );
}

function NextUp({ list, today }: { list: Birthday[]; today: number }) {
  const next = nextBirthdays(list, today);
  if (!next) return null;
  const { people } = next;
  const names = people.map((p) => p.name).join(", ");
  const first = people[0];
  return (
    <p className="bday-next">
      <span className="bday-next-label">다음 생일</span>
      <b className="bday-next-date">
        {first.month}월 {first.day}일 {weekday(next.day)}
      </b>
      <span className="bday-next-names">{names}</span>
      <span className="bday-dday">{formatDday(next.day - today)}</span>
    </p>
  );
}

type GridProps = { list: Birthday[]; year: number; month: number; today: number };

function MonthGrid({ list, year, month, today }: GridProps) {
  const { lead, cells } = monthCells(list, year, month);
  const total = cells.reduce((n, c) => n + c.people.length, 0);
  // 고른 달은 위 탭이 보여주므로 화면 제목은 따로 두지 않고 읽기 도구용 이름만 붙인다
  if (total === 0) {
    return (
      <section className="bday-cal" aria-label={`${month}월 생일`}>
        <p className="notice">{month}월 생일인 캐릭터가 없어요. 다른 달을 골라 보세요.</p>
      </section>
    );
  }
  return (
    <section className="bday-cal" aria-label={`${month}월 생일`}>
      <div className="bday-week" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <ol className="bday-grid">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} className="bday-blank" aria-hidden="true" />
        ))}
        {cells.map((c) => (
          <li
            key={c.date}
            className={`bday-day${c.people.length ? " has-people" : ""}${c.day === today ? " is-today" : ""}`}
          >
            <span className="bday-date">
              <b aria-hidden="true">{c.date}</b>
              <span className="bday-wd">
                {month}월 {c.date}일 {weekday(c.day)}
              </span>
              {c.day === today && <span className="bday-today">오늘</span>}
            </span>
            {c.people.length > 0 && (
              <ul className="bday-people">
                {c.people.map((p) => (
                  <li key={p.id}>
                    <img src={p.icon} alt="" width={32} height={32} loading="lazy" />
                    <span>{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
