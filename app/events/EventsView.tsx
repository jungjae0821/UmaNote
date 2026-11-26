"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { formatMd, formatMdTime, monthOf, relative } from "@/lib/dates";
import { Live } from "@/components/Live";
import { SupportTypeIcon } from "@/components/SupportTypeIcon";
import type { EventKind, Lane, SupportType } from "@/lib/gametora";
import "./events.css";
import { useToday } from "@/lib/useToday";

type MiniCard = { id: number; name: string; art: string; lane: Lane; supportType?: SupportType };
export type ViewEvent = {
  kind: EventKind;
  id: string;
  name: string;
  start: number;
  end: number;
  startTs: number;
  endTs: number;
  race?: { ground: string; distance: number; track?: string };
  bonus: MiniCard[];
  rewards: MiniCard[];
  rivals: MiniCard[];
  estimated?: boolean;
  /** 상세 페이지가 있는지 */
  detail?: boolean;
};

const KINDS: { kind: EventKind; name: string }[] = [
  { kind: "story", name: "스토리 이벤트" },
  { kind: "cm", name: "챔피언스 미팅" },
  { kind: "loh", name: "리그 오브 히어로즈" },
  { kind: "legend", name: "레전드 레이스" },
  { kind: "research", name: "인자연구" },
  { kind: "exam", name: "트레이너 기능시험" },
  { kind: "masters", name: "마스터즈 챌린지" },
];
const KIND_NAME = Object.fromEntries(KINDS.map((k) => [k.kind, k.name])) as Record<EventKind, string>;

const href = (c: MiniCard) => `/characters/${c.lane === "train" ? "t" : "s"}${c.id}`;

function Faces({ label, cards }: { label: string; cards: MiniCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="ev-faces">
      <span>{label}</span>
      {cards.map((c) => (
        <Link key={c.id} href={href(c)} title={c.name}>
          <img src={c.art} alt={c.name} loading="lazy" />
        </Link>
      ))}
    </div>
  );
}

function RaceTag({ e }: { e: ViewEvent }) {
  if (!e.race) return null;
  return (
    <span className="tag">
      {e.race.track ? `${e.race.track} ` : ""}
      {e.race.ground} {e.race.distance}m
    </span>
  );
}

export function EventsView({ events, today: serverToday }: { events: ViewEvent[]; today: number }) {
  const today = useToday(serverToday);
  const [kinds, setKinds] = useState<EventKind[]>(KINDS.map((k) => k.kind));
  // 홈에서 /events#이벤트ID로 들어오면 그 줄을 잠깐 강조한다. 강조한 히스토리 항목에는 표시를 남겨
  // 상세 페이지에 갔다가 뒤로 왔을 때는 다시 강조하지 않는다. 주소는 그대로 둬야 Next 라우터와 어긋나지 않는다
  const [flashId, setFlashId] = useState<string | null>(null);
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const state = window.history.state as Record<string, unknown> | null;
    if (!id || state?.evFlashed) return;
    setFlashId(id);
    window.history.replaceState({ ...state, evFlashed: true }, "", window.location.href);
  }, []);
  const toggle = (k: EventKind) =>
    setKinds((cur) => {
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      return next.length ? next : [k];
    });

  const live = events.filter((e) => e.start <= today && today <= e.end);
  const filtered = useMemo(() => events.filter((e) => kinds.includes(e.kind)), [events, kinds]);
  const upcoming = filtered.filter((e) => e.end >= today);
  const past = filtered.filter((e) => e.end < today).reverse();

  const byMonth = (list: ViewEvent[]) => {
    const groups: { key: string; label: string; items: ViewEvent[] }[] = [];
    for (const e of list) {
      const { y, m } = monthOf(e.start);
      const key = `${y}-${m}`;
      const g = groups.find((x) => x.key === key);
      if (g) g.items.push(e);
      else groups.push({ key, label: `${y}년 ${m}월`, items: [e] });
    }
    return groups;
  };

  const renderItem = (e: ViewEvent) => {
    const r = relative(e.start, e.end, today);
    return (
      <li key={e.id} id={e.id} className={`ev-item${e.id === flashId ? " flash" : ""}`}>
        <span className={`ev-kind k-${e.kind}`}>{KIND_NAME[e.kind]}</span>
        <div className="ev-main">
          {e.detail ? (
            <Link href={`/events/${e.id}`} className="ev-link">
              <b>{e.name}</b>
            </Link>
          ) : (
            <b>{e.name}</b>
          )}
          <span className="ev-period">
            {formatMd(e.start)} ~ {formatMd(e.end)}
          </span>
        </div>
        <div className="ev-extra">
          {e.estimated && <span className="tag">날짜 예상</span>}
          <RaceTag e={e} />
          {e.rivals.length > 0 && <span className="tag">상대 {e.rivals.map((c) => c.name).join(", ")}</span>}
          {e.rewards.length > 0 && (
            <span className="tag">
              보상{" "}
              {e.rewards.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 && ", "}
                  <SupportTypeIcon type={c.supportType} />
                  {c.name}
                </Fragment>
              ))}
            </span>
          )}
        </div>
        <span className={`chip${r.urgent ? " urgent" : ""}`}>{r.text}</span>
      </li>
    );
  };

  return (
    <div className="stack">
      <section>
        <h2 className="section-title">진행 중</h2>
        {live.length === 0 ? (
          <p className="panel glass empty">지금 진행 중인 이벤트가 없습니다.</p>
        ) : (
          <div className="ev-live">
            {live.map((e) => (
              <article key={e.id} className="ev-card panel glass" id={`live-${e.id}`}>
                <div className="ev-card-top">
                  <span className={`ev-kind k-${e.kind}`}>{KIND_NAME[e.kind]}</span>
                  <Live start={e.start} end={e.end} today={today} />
                </div>
                <h3>{e.detail ? <Link href={`/events/${e.id}`} className="ev-link">{e.name}</Link> : e.name}</h3>
                <p className="ev-period">
                  {formatMdTime(e.startTs)} ~ {formatMdTime(e.endTs)}
                </p>
                <div className="tags-row">
                  {e.estimated && <span className="tag">날짜 예상</span>}
                  <RaceTag e={e} />
                </div>
                <Faces label="보너스" cards={e.bonus} />
                <Faces label="보상" cards={e.rewards} />
                <Faces label="상대" cards={e.rivals} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="ev-filter" role="group" aria-label="이벤트 종류">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" className="filter-chip" aria-pressed={kinds.includes(k.kind)} onClick={() => toggle(k.kind)}>
              {k.name}
            </button>
          ))}
        </div>
        {byMonth(upcoming).map((g) => (
          <div key={g.key} className="ev-month">
            <h3>{g.label}</h3>
            <ul className="panel glass ev-list">{g.items.map(renderItem)}</ul>
          </div>
        ))}
        {upcoming.length === 0 && <p className="panel glass empty">고른 종류의 다가오는 이벤트가 없습니다.</p>}
        {past.length > 0 && (
          <>
            <h2 className="section-title ev-past-title">지난 이벤트</h2>
            {byMonth(past).map((g) => (
              <div key={g.key} className="ev-month">
                <h3>{g.label}</h3>
                <ul className="panel glass ev-list">{g.items.map(renderItem)}</ul>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
