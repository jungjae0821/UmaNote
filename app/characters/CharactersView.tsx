"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { SupportTypeIcon } from "@/components/SupportTypeIcon";
import type { Lane, SupportType } from "@/lib/gametora";
import "./characters.css";
import { useToday } from "@/lib/useToday";

export type ListCard = {
  id: number;
  lane: Lane;
  name: string;
  title: string;
  rarity: number;
  art: string;
  /** 한국서버 출시일(확정 또는 가챠 일정) */
  releaseKr: number | null;
  /** 이 날까지 신규 표시 */
  newUntil: number | null;
  obtained: string;
  supportType?: SupportType;
  aptitude?: string[];
};

const SUPPORT_TYPES: { v: SupportType; label: string }[] = [
  { v: "speed", label: "스피드" },
  { v: "stamina", label: "스태미나" },
  { v: "power", label: "파워" },
  { v: "guts", label: "근성" },
  { v: "intelligence", label: "지능" },
  { v: "friend", label: "우정" },
  { v: "group", label: "그룹" },
];
// aptitude 순서: 잔디, 더트, 단거리, 마일, 중거리, 장거리, 도주, 선행, 선입, 추입
const DISTANCES = [
  { i: 2, label: "단거리" },
  { i: 3, label: "마일" },
  { i: 4, label: "중거리" },
  { i: 5, label: "장거리" },
];
const STYLES = [
  { i: 6, label: "도주" },
  { i: 7, label: "선행" },
  { i: 8, label: "선입" },
  { i: 9, label: "추입" },
];
const OBTAINED: Record<string, string> = {
  gacha: "가챠",
  story_event: "스토리 이벤트",
  limited_quest: "기간 한정",
  main_story: "메인 스토리",
  shop: "상점",
  promo: "프로모션",
};

type Filters = {
  lane: Lane | "all";
  rarity: number[];
  types: SupportType[];
  distance: number[];
  style: number[];
  obtained: string[];
  release: "all" | "released" | "upcoming";
};

const EMPTY: Filters = { lane: "all", rarity: [], types: [], distance: [], style: [], obtained: [], release: "all" };

type Saved = { f: Filters; query: string; sort: "release" | "name"; scrollY: number };

// 상세로 갔다가 뒤로가기 하면 목록이 새로 마운트되므로, 마지막 상태를 모듈에 들고 있다가
// 뒤로/앞으로 이동(popstate)으로 돌아왔을 때만 되살린다. 새로고침하면 모듈이 초기화된다.
let saved: Saved | null = null;
let poppedBack = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    poppedBack = true;
  });
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const good = (grade?: string) => grade === "A" || grade === "S";

function Group({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="fg">
      <button type="button" className="fg-title" aria-expanded={open} onClick={() => setOpen(!open)}>
        {title}
        <span className={open ? "" : "rot"}>
          <Icon name="chevronDown" />
        </span>
      </button>
      {open && <div className="fg-body">{children}</div>}
    </div>
  );
}

export function CharactersView({ cards, today: serverToday }: { cards: ListCard[]; today: number }) {
  const today = useToday(serverToday);
  const [restore] = useState(() => (poppedBack ? saved : null));
  const [f, setF] = useState<Filters>(restore?.f ?? EMPTY);
  const [query, setQuery] = useState(restore?.query ?? "");
  const [sort, setSort] = useState<"release" | "name">(restore?.sort ?? "release");

  useLayoutEffect(() => {
    poppedBack = false;
    if (restore) window.scrollTo(0, restore.scrollY);
  }, [restore]);

  useEffect(() => {
    saved = { f, query, sort, scrollY: saved?.scrollY ?? 0 };
  }, [f, query, sort]);

  useEffect(() => {
    const onScroll = () => {
      if (saved) saved.scrollY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isUpcoming = (c: ListCard) => c.releaseKr === null || c.releaseKr > today;
  const isNew = (c: ListCard) => !isUpcoming(c) && c.newUntil !== null && today <= c.newUntil;

  const list = useMemo(() => {
    const q = query.trim().replace(/\s/g, "");
    const out = cards.filter((c) => {
      if (f.lane !== "all" && c.lane !== f.lane) return false;
      if (f.rarity.length && !f.rarity.includes(c.rarity)) return false;
      if (f.types.length && (c.lane !== "support" || !f.types.includes(c.supportType as SupportType))) return false;
      if (f.distance.length && (c.lane !== "train" || !f.distance.some((i) => good(c.aptitude?.[i])))) return false;
      if (f.style.length && (c.lane !== "train" || !f.style.some((i) => good(c.aptitude?.[i])))) return false;
      if (f.obtained.length && !f.obtained.includes(c.obtained)) return false;
      if (f.release === "released" && isUpcoming(c)) return false;
      if (f.release === "upcoming" && !isUpcoming(c)) return false;
      if (q && !`${c.name}${c.title}`.replace(/\s/g, "").includes(q)) return false;
      return true;
    });
    return out.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "ko") || a.id - b.id
        : // 미출시 카드는 일정이 잡혀 있어도 맨 뒤로
          (isUpcoming(b) ? -Infinity : (b.releaseKr as number)) - (isUpcoming(a) ? -Infinity : (a.releaseKr as number)) ||
            b.id - a.id,
    );
  }, [cards, f, query, sort, today]);

  const RARITY_LABEL = f.lane === "support" ? ["", "R", "SR", "SSR"] : f.lane === "train" ? ["", "★1", "★2", "★3"] : ["", "★1·R", "★2·SR", "★3·SSR"];
  const active = JSON.stringify(f) !== JSON.stringify(EMPTY);

  return (
    <div className="chars">
      <aside className={`filters panel glass${filtersOpen ? " open" : ""}`} aria-label="필터">
        <div className="filters-head">
          <b>필터</b>
          {active && (
            <button type="button" className="btn" onClick={() => setF(EMPTY)}>
              초기화
            </button>
          )}
        </div>
        <div className="fg-static">
          <span>구분</span>
          <div className="chips">
            {(["all", "train", "support"] as const).map((l) => (
              <button key={l} type="button" className="filter-chip" aria-pressed={f.lane === l} onClick={() => setF({ ...f, lane: l })}>
                {l === "all" ? "전체" : l === "train" ? "육성" : "서포트"}
              </button>
            ))}
          </div>
        </div>
        <div className="fg-static">
          <span>희귀도</span>
          <div className="chips">
            {[3, 2, 1].map((r) => (
              <button key={r} type="button" className="filter-chip" aria-pressed={f.rarity.includes(r)} onClick={() => setF({ ...f, rarity: toggle(f.rarity, r) })}>
                {RARITY_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <Group title="서포트 타입">
          <div className="chips">
            {SUPPORT_TYPES.map((t) => (
              <button key={t.v} type="button" className="filter-chip" aria-pressed={f.types.includes(t.v)} onClick={() => setF({ ...f, types: toggle(f.types, t.v) })}>
                {t.label}
              </button>
            ))}
          </div>
        </Group>
        <Group title="거리 적성 (A 이상)">
          <div className="chips">
            {DISTANCES.map((d) => (
              <button key={d.i} type="button" className="filter-chip" aria-pressed={f.distance.includes(d.i)} onClick={() => setF({ ...f, distance: toggle(f.distance, d.i) })}>
                {d.label}
              </button>
            ))}
          </div>
        </Group>
        <Group title="각질 적성 (A 이상)">
          <div className="chips">
            {STYLES.map((d) => (
              <button key={d.i} type="button" className="filter-chip" aria-pressed={f.style.includes(d.i)} onClick={() => setF({ ...f, style: toggle(f.style, d.i) })}>
                {d.label}
              </button>
            ))}
          </div>
        </Group>
        <Group title="획득 경로">
          <div className="chips">
            {Object.entries(OBTAINED).map(([v, label]) => (
              <button key={v} type="button" className="filter-chip" aria-pressed={f.obtained.includes(v)} onClick={() => setF({ ...f, obtained: toggle(f.obtained, v) })}>
                {label}
              </button>
            ))}
          </div>
        </Group>
        <Group title="한국 출시">
          <div className="chips">
            {(
              [
                ["all", "전체"],
                ["released", "출시"],
                ["upcoming", "미출시"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className="filter-chip" aria-pressed={f.release === v} onClick={() => setF({ ...f, release: v })}>
                {label}
              </button>
            ))}
          </div>
        </Group>
      </aside>

      <div className="chars-main">
        <div className="chars-bar">
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">이름으로 찾기</span>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="캐릭터 이름" />
          </label>
          <button type="button" className="btn filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            필터{active ? " 적용 중" : ""}
          </button>
          <div className="seg" role="group" aria-label="정렬">
            <button type="button" aria-pressed={sort === "release"} onClick={() => setSort("release")}>
              출시일순
            </button>
            <button type="button" aria-pressed={sort === "name"} onClick={() => setSort("name")}>
              이름순
            </button>
          </div>
        </div>
        <p className="chars-count">{list.length.toLocaleString("ko-KR")}장</p>
        {list.length === 0 ? (
          <p className="panel glass empty">조건에 맞는 카드가 없습니다. 필터를 줄여 보세요.</p>
        ) : (
          <ul className="chars-grid">
            {list.map((c) => (
              <li key={`${c.lane}${c.id}`}>
                <Link href={`/characters/${c.lane === "train" ? "t" : "s"}${c.id}`} className="ccard">
                  <span className="art">
                    <img src={c.art} alt="" loading="lazy" />
                    {isUpcoming(c) ? <span className="badge">예정</span> : isNew(c) && <span className="badge fresh">신규</span>}
                  </span>
                  <b>
                    <SupportTypeIcon type={c.supportType} />
                    {c.name}
                  </b>
                  <small>{c.title}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
