import type { Metadata } from "next";
import { todayKr } from "@/lib/dates";
import { getEvents, hasEventDetail } from "@/lib/gametora";
import { EventsView, type ViewEvent } from "./EventsView";

export const metadata: Metadata = { title: "이벤트" };
export const revalidate = 3600;

export default async function EventsPage() {
  const today = todayKr();
  const events: ViewEvent[] = (await getEvents()).map((e) => ({
    kind: e.kind,
    id: e.id,
    name: e.name,
    start: e.start,
    end: e.end,
    startTs: e.startTs,
    endTs: e.endTs,
    race: e.race,
    bonus: (e.bonusCards ?? []).map((c) => ({ id: c.id, name: c.name, art: c.art, lane: c.lane })),
    rewards: (e.rewardSupports ?? []).map((c) => ({ id: c.id, name: c.name, art: c.art, lane: c.lane, supportType: c.supportType })),
    rivals: (e.rivals ?? []).map((c) => ({ id: c.id, name: c.name, art: c.art, lane: c.lane })),
    estimated: e.estimated,
    detail: hasEventDetail(e.kind),
  }));
  return (
    <>
      <div className="page-head">
        <h1>이벤트</h1>
      </div>
      <EventsView events={events} today={today} />
    </>
  );
}
