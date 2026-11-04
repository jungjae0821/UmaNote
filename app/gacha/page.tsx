import Link from "next/link";
import { Suspense } from "react";
import { GachaEntry } from "@/components/GachaEntry";
import { MonthPicker } from "@/components/MonthPicker";
import { formatFull, formatShort, krToJp, monthOf, monthStart, todayKr, weekday } from "@/lib/dates";
import { logFailure } from "@/lib/fetchJson";
import { getGachasBetween, getGachaSpan, type Gacha, type Lane } from "@/lib/umapyoi";

export const metadata = { title: "가챠 일정 | 우마노트" };
export const revalidate = 3600;

// 한 달에 걸치는 배너가 많을 때(주년 이벤트 달은 40개 안팎) 모두 받도록 넉넉히
const MONTH_LIMIT = 60;

type LaneFilter = "all" | Lane;

const FILTERS: { value: LaneFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "train", label: "육성 우마무스메" },
  { value: "support", label: "서포트 카드" },
];

type Props = { searchParams: Promise<{ month?: string; lane?: string }> };

type Stop = { day: number; carried: boolean; gachas: Gacha[] };

function parseMonth(raw: string | undefined, today: number): { y: number; m: number } {
  const match = raw?.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m >= 1 && m <= 12) return { y, m };
  }
  return monthOf(today);
}

const monthKey = ({ y, m }: { y: number; m: number }) => `${y}-${String(m).padStart(2, "0")}`;

function shift({ y, m }: { y: number; m: number }, by: number) {
  const i = y * 12 + (m - 1) + by;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

function href(month: { y: number; m: number }, lane: LaneFilter) {
  const q = new URLSearchParams({ month: monthKey(month) });
  if (lane !== "all") q.set("lane", lane);
  return `/gacha?${q}`;
}

// 같은 날 시작하는 배너를 한 정거장으로 묶는다. 지난달부터 이어지는 배너는 맨 앞 정거장 하나로
function toStops(gachas: Gacha[], from: number): Stop[] {
  const stops = new Map<number, Stop>();
  for (const g of gachas) {
    const carried = g.startKr < from;
    const day = carried ? from - 1 : g.startKr;
    const stop = stops.get(day) ?? { day, carried, gachas: [] };
    stop.gachas.push(g);
    stops.set(day, stop);
  }
  return [...stops.values()].sort((a, b) => a.day - b.day);
}

export default async function GachaPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = todayKr();
  const lane: LaneFilter = params.lane === "train" || params.lane === "support" ? params.lane : "all";

  let span: { firstKr: number; lastKr: number } | null = null;
  try {
    span = await getGachaSpan();
  } catch (err) {
    logFailure("가챠 기간", err);
    span = null;
  }

  // 데이터가 있는 달 바깥으로는 가지 않는다
  let month = parseMonth(params.month, today);
  if (span) {
    const first = monthOf(span.firstKr);
    const last = monthOf(span.lastKr);
    if (monthKey(month) < monthKey(first)) month = first;
    if (monthKey(month) > monthKey(last)) month = last;
  }
  const from = monthStart(month.y, month.m);
  const to = monthStart(shift(month, 1).y, shift(month, 1).m) - 1;
  const prev = shift(month, -1);
  const next = shift(month, 1);
  const hasPrev = !span || from > span.firstKr;
  const hasNext = !span || to < span.lastKr;
  const thisMonth = monthOf(today);
  const isThisMonth = monthKey(month) === monthKey(thisMonth);

  return (
    <main className="page sched">
      <div className="sched-head">
        <div>
          <h1>가챠 일정</h1>
          <p className="sub">한국서버 예상일 기준이에요. 일본서버 날짜는 476일 앞이고 날짜 아래 작게 적었어요.</p>
        </div>
        <nav className="seg" aria-label="가챠 종류">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={href(month, f.value)}
              aria-current={f.value === lane ? "true" : undefined}
              className={f.value === "all" ? undefined : `seg-${f.value}`}
            >
              {f.value !== "all" && <i aria-hidden="true" />}
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="month-nav" aria-label="달 이동">
        {hasPrev ? (
          <Link href={href(prev, lane)} className="month-step" aria-label={`${prev.y}년 ${prev.m}월`}>
            ‹ {prev.m}월
          </Link>
        ) : (
          <span className="month-step" aria-hidden="true" />
        )}
        <h2 className="month-title">
          {span ? (
            <MonthPicker
              month={month}
              first={monthOf(span.firstKr)}
              last={monthOf(span.lastKr)}
              thisMonth={thisMonth}
              hrefBase={lane === "all" ? "" : `lane=${lane}`}
            />
          ) : (
            `${month.y}년 ${month.m}월`
          )}
          <small>
            일본 {formatFull(krToJp(from))} – {formatShort(krToJp(to))}
          </small>
        </h2>
        {hasNext ? (
          <Link href={href(next, lane)} className="month-step month-next" aria-label={`${next.y}년 ${next.m}월`}>
            {next.m}월 ›
          </Link>
        ) : (
          <span className="month-step" aria-hidden="true" />
        )}
        {!isThisMonth && (
          <Link href={href(thisMonth, lane)} className="month-now">
            이번 달로
          </Link>
        )}
      </nav>

      {span === null ? (
        <LoadError />
      ) : (
        // 달이나 종류를 바꾸면 머리줄은 그대로 두고 일정만 다시 불러온다
        <Suspense key={`${monthKey(month)}-${lane}`} fallback={<RailLoading />}>
          <MonthRail from={from} to={to} lane={lane} today={today} label={`${month.y}년 ${month.m}월`} />
        </Suspense>
      )}

      <p className="sched-note">
        유료 쥬얼로만 돌릴 수 있는 가챠는 &lsquo;유료 쥬얼&rsquo;, 그 밖에 정규 픽업 배너가 아닌 가챠는 &lsquo;특별&rsquo;로 표시해요. 몇 달씩 열려 있는 상설 가챠는 넣지 않았어요.
      </p>
    </main>
  );
}

function LoadError() {
  return (
    <div className="notice" role="alert">
      <b>가챠 일정을 불러오지 못했어요.</b>
      <p>umapyoi.net에서 응답이 오지 않았어요. 잠시 뒤 새로고침해 주세요.</p>
    </div>
  );
}

function RailLoading() {
  return (
    <p className="notice" role="status">
      umapyoi.net에서 이 달의 가챠 일정을 불러오는 중이에요.
    </p>
  );
}

type RailProps = { from: number; to: number; lane: LaneFilter; today: number; label: string };

async function MonthRail({ from, to, lane, today, label }: RailProps) {
  let gachas: Gacha[];
  try {
    gachas = await getGachasBetween(from, to, { special: true, limit: MONTH_LIMIT });
  } catch (err) {
    logFailure(`${label} 가챠 일정`, err);
    return <LoadError />;
  }

  const stops = toStops(
    gachas.filter((g) => lane === "all" || g.lane === lane),
    from,
  );
  if (stops.length === 0) {
    const kind = lane === "all" ? "" : `${FILTERS.find((f) => f.value === lane)?.label} `;
    return (
      <p className="notice">
        {label}에는 {kind}가챠가 없어요. 다른 달로 넘기거나 종류를 전체로 바꿔 보세요.
      </p>
    );
  }

  const isThisMonth = from <= today && today <= to;
  const todayIndex = isThisMonth ? stops.findIndex((s) => !s.carried && s.day > today) : -1;
  return (
    <ol className="rail">
      {stops.map((s, i) => (
        <RailStop key={s.day} stop={s} today={today} showTodayBefore={i === todayIndex} />
      ))}
      {isThisMonth && todayIndex === -1 && <TodayMark today={today} />}
    </ol>
  );
}

function TodayMark({ today }: { today: number }) {
  return (
    <li className="rail-today">
      <span>오늘 {formatShort(today)}</span>
    </li>
  );
}

function RailStop({ stop, today, showTodayBefore }: { stop: Stop; today: number; showTodayBefore: boolean }) {
  const past = stop.gachas.every((g) => g.endKr < today);
  const startJp = krToJp(stop.day);
  return (
    <>
      {showTodayBefore && <TodayMark today={today} />}
      <li className={`stop${past ? " stop-past" : ""}`}>
        <div className="stop-date">
          {stop.carried ? (
            <b className="stop-carried">지난달부터</b>
          ) : (
            <>
              <b>
                {formatShort(stop.day)}
                <span className="stop-wd">{weekday(stop.day)}</span>
              </b>
              <small>일본 {formatFull(startJp)}</small>
            </>
          )}
        </div>
        <div className="stop-body">
          {stop.gachas.map((g) => (
            <GachaEntry key={g.id} gacha={g} today={today} />
          ))}
        </div>
      </li>
    </>
  );
}
