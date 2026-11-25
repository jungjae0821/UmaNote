import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Live } from "@/components/Live";
import { formatMdTime, formatFull, todayKr } from "@/lib/dates";
import {
  EVENT_KIND_NAME,
  getCourse,
  getEvents,
  getLegendRivals,
  hasEventDetail,
  type GameEvent,
} from "@/lib/gametora";
import { CONDITION, CourseSection, RaceSection, WEATHER } from "./CourseView";
import { LegendRivals } from "./LegendRivals";
import "../events.css";
import "./detail.css";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

async function findEvent(id: string): Promise<GameEvent | undefined> {
  return (await getEvents()).find((e) => e.id === id && hasEventDetail(e.kind));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = await findEvent((await params).id);
  return { title: e ? e.name : "이벤트" };
}

const timeOf = (ts: number) => formatMdTime(ts).split(" ")[1];
const numId = (e: GameEvent) => Number(e.id.split("-")[1]);

/** 챔미·리오히: 경기 조건, 코스 구조, 같은 코스를 쓴 다른 이벤트 */
async function RaceEventBody({ e }: { e: GameEvent }) {
  const race = e.race;
  const course = race?.courseSet ? await getCourse(race.courseSet) : undefined;
  const sameCourse = race?.courseSet
    ? (await getEvents()).filter((x) => x.id !== e.id && x.race?.courseSet === race.courseSet && (x.kind === "cm" || x.kind === "loh"))
    : [];
  return (
    <>
      {race && <RaceSection race={race} course={course} />}
      {course && <CourseSection c={course} />}
      {sameCourse.length > 0 && (
        <section>
          <h2 className="section-title">같은 코스의 다른 이벤트</h2>
          <ul className="panel glass ev-list">
            {sameCourse.map((x) => (
              <li key={x.id} className="evd-same">
                <Link href={`/events/${x.id}`}>
                  <span className={`ev-kind k-${x.kind}`}>{EVENT_KIND_NAME[x.kind]}</span>
                  <b>{x.name}</b>
                  <span className="ev-period">
                    {formatFull(x.start)}
                    {x.race?.weather ? ` · ${WEATHER[x.race.weather]}` : ""}
                    {x.race?.condition ? ` · ${CONDITION[x.race.condition]}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

async function LegendBody({ e, today }: { e: GameEvent; today: number }) {
  const rivals = await getLegendRivals(numId(e));
  return rivals ? <LegendRivals rivals={rivals} today={today} /> : null;
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const e = await findEvent((await params).id);
  if (!e) notFound();
  const today = todayKr();

  return (
    <>
      <div className="page-head">
        <h1>{e.name}</h1>
      </div>
      <div className="stack">
        <section className="evd-top">
          {e.banner && <img className="evd-banner" src={e.banner} alt="" />}
          <div className="panel glass">
            <div className="ev-card-top">
              <span className={`ev-kind k-${e.kind}`}>{EVENT_KIND_NAME[e.kind]}</span>
              <Live start={e.start} end={e.end} today={today} />
            </div>
            <p className="evd-period">
              {formatFull(e.start)} {timeOf(e.startTs)} ~ {formatFull(e.end)} {timeOf(e.endTs)}
              {e.estimated && <span className="tag">날짜 예상</span>}
            </p>
          </div>
        </section>

        {(e.kind === "cm" || e.kind === "loh") && <RaceEventBody e={e} />}
        {e.kind === "legend" && <LegendBody e={e} today={today} />}
      </div>
    </>
  );
}
