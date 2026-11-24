"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { SupportTypeIcon } from "@/components/SupportTypeIcon";
import { pickupLabel, type ViewBanner } from "@/lib/bannerView";
import { formatMdTime, monthOf, monthStart, relative } from "@/lib/dates";
import { formatRate } from "@/lib/gachaPool";
import type { Lane } from "@/lib/gametora";
import "./futures.css";
import { useToday } from "@/lib/useToday";

const KEY = "umanote:futures:v1";
type Prefs = { lanes: Lane[] };
const DEFAULT_PREFS: Prefs = { lanes: ["train", "support"] };

function readPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    if (!v) return DEFAULT_PREFS;
    const lanes = (v.lanes ?? []).filter((l): l is Lane => l === "train" || l === "support");
    return { lanes: lanes.length ? lanes : DEFAULT_PREFS.lanes };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** 배너 이미지가 아직 없을 때 픽업 일러스트를 나란히 */
function ArtFallback({ b, className }: { b: ViewBanner; className?: string }) {
  return (
    <span className={`art-fallback ${className ?? ""}`} aria-hidden>
      {b.pickups.slice(0, 4).map((p) => (
        <img key={p.id} src={p.art} alt="" loading="lazy" />
      ))}
    </span>
  );
}

export function FuturesView({ banners, today: serverToday, initialBanner }: { banners: ViewBanner[]; today: number; initialBanner: number | null }) {
  const today = useToday(serverToday);
  const initial = banners.find((b) => b.id === initialBanner) ?? null;
  const [month, setMonth] = useState(() => monthOf(initial ? initial.start : today));
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [selected, setSelected] = useState<ViewBanner | null>(initial);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => setPrefs(readPrefs()), []);
  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // 저장소를 못 쓰면 이번 방문 동안만 기억한다
    }
  };

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (selected && !d.open) d.showModal();
    if (!selected && d.open) d.close();
  }, [selected]);

  const first = monthStart(month.y, month.m);
  const last = monthStart(month.y, month.m + 1) - 1;
  const visible = useMemo(() => banners.filter((b) => prefs.lanes.includes(b.lane)), [banners, prefs.lanes]);
  // 진행 중 → 예정 → 종료 순, 같은 상태 안에서는 시작일 순
  const stateRank = (b: ViewBanner) => (b.end < today ? 2 : b.start > today ? 1 : 0);
  const inMonth = visible
    .filter((b) => b.start <= last && b.end >= first)
    .sort((a, b) => stateRank(a) - stateRank(b) || a.start - b.start || a.id - b.id);

  const move = (delta: number) => setMonth(({ y, m }) => monthOf(monthStart(y, m + delta)));
  const toggleLane = (lane: Lane) => {
    const has = prefs.lanes.includes(lane);
    const lanes = has ? prefs.lanes.filter((l) => l !== lane) : [...prefs.lanes, lane];
    save({ ...prefs, lanes: lanes.length ? lanes : [lane] });
  };
  const isThisMonth = monthOf(today).y === month.y && monthOf(today).m === month.m;

  return (
    <div className="futures">
      <div className="fut-bar">
        <div className="month-nav">
          <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="이전 달">
            <Icon name="chevronLeft" />
          </button>
          <h2 aria-live="polite">
            {month.y}년 {month.m}월
          </h2>
          <button type="button" className="icon-btn" onClick={() => move(1)} aria-label="다음 달">
            <Icon name="chevronRight" />
          </button>
          <button type="button" className="btn" onClick={() => setMonth(monthOf(today))} disabled={isThisMonth}>
            오늘
          </button>
        </div>
        <div className="fut-filters">
          <div className="chips" role="group" aria-label="가챠 종류">
            <button type="button" className="filter-chip" aria-pressed={prefs.lanes.includes("train")} onClick={() => toggleLane("train")}>
              육성 우마무스메
            </button>
            <button type="button" className="filter-chip" aria-pressed={prefs.lanes.includes("support")} onClick={() => toggleLane("support")}>
              서포트 카드
            </button>
          </div>
        </div>
      </div>

      <div className="fut-list">
        {inMonth.length === 0 && <p className="empty glass panel">이 달에는 고른 종류의 픽업이 없습니다.</p>}
        {inMonth.map((b) => {
          const r = relative(b.start, b.end, today);
          return (
            <button key={b.id} type="button" className="fut-item glass" onClick={() => setSelected(b)}>
              {b.art ? <img className="fut-art" src={b.art} alt="" loading="lazy" /> : <ArtFallback b={b} className="fut-art" />}
              <div className="fut-body">
                <div className="fut-top">
                  <span className={`tag ${b.lane}`}>{b.lane === "train" ? "육성" : "서포트"}</span>
                  {b.paidOnly && <span className="tag">유료 쥬얼 전용</span>}
                  {b.star3Up && <span className="tag">★3 확률 업</span>}
                  {b.estimated && <span className="tag">날짜 예상</span>}
                  <span className={`chip${r.urgent ? " urgent" : ""}`}>{r.text}</span>
                </div>
                <b className="fut-name">{pickupLabel(b)}</b>
                <span className="fut-period">
                  {formatMdTime(b.startTs)} ~ {formatMdTime(b.endTs)}
                </span>
                <span className="fut-faces">
                  {b.pickups.slice(0, 6).map((p) => (
                    <img key={p.id} src={p.art} alt="" loading="lazy" />
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        className="fut-dialog glass"
        onClose={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setSelected(null);
        }}
        aria-label="배너 상세"
      >
        {selected && (
          <>
            <div className="fd-art">
              {selected.art ? <img src={selected.art} alt="" /> : <ArtFallback b={selected} />}
              <button type="button" className="icon-btn fd-close" onClick={() => setSelected(null)} aria-label="닫기">
                <Icon name="close" />
              </button>
            </div>
            <div className="fd-body">
              <div className="fut-top">
                <span className={`tag ${selected.lane}`}>{selected.lane === "train" ? "육성 우마무스메" : "서포트 카드"}</span>
                {selected.paidOnly && <span className="tag">유료 쥬얼 전용</span>}
                {selected.star3Up && <span className="tag">★3 확률 업</span>}
                {selected.estimated && <span className="tag">날짜 예상</span>}
              </div>
              <p className="fd-period">
                {formatMdTime(selected.startTs)} ~ {formatMdTime(selected.endTs)} · {relative(selected.start, selected.end, today).text}
              </p>
              <ul className="fd-picks">
                {selected.pickups.map((p) => (
                  <li key={p.id}>
                    <Link href={`/characters/${p.lane === "train" ? "t" : "s"}${p.id}`}>
                      <img src={p.art} alt="" loading="lazy" />
                      <span>
                        <small>{p.title}</small>
                        <b>
                          <SupportTypeIcon type={p.supportType} />
                          {p.name}
                        </b>
                      </span>
                      <span className="fd-rate">
                        {p.isNew && <span className="tag">신규</span>}
                        <span className="tag">{formatRate(p.rate)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {selected.pickups.length === 0 && <li className="empty">픽업 대상 정보가 없습니다.</li>}
              </ul>
              {!selected.paidOnly && (
                <Link href={`/simulator?lane=${selected.lane}&banner=${selected.id}`} className="btn primary fd-sim">
                  <Icon name="cards" />이 배너로 뽑기 시뮬레이션
                </Link>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
