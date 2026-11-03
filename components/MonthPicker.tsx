"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Month = { y: number; m: number };

type Props = {
  month: Month;
  /** 데이터가 있는 첫 달과 마지막 달 */
  first: Month;
  last: Month;
  thisMonth: Month;
  /** 고른 달로 가는 주소 */
  hrefBase: string;
};

const key = ({ y, m }: Month) => y * 12 + m;

// 달 제목을 누르면 연도와 12개월 칸이 열린다. 데이터가 없는 달은 고를 수 없다
export function MonthPicker({ month, first, last, thisMonth, hrefBase }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(month.y);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (m: number) => {
    setOpen(false);
    const q = new URLSearchParams(hrefBase);
    q.set("month", `${year}-${String(m).padStart(2, "0")}`);
    router.push(`/gacha?${q}`);
  };

  return (
    <div className="mp" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="mp-trigger"
        aria-expanded={open}
        aria-controls="month-picker"
        onClick={() => {
          setYear(month.y);
          setOpen((v) => !v);
        }}
      >
        {month.y}년 {month.m}월
        <span className="mp-caret" aria-hidden="true" />
      </button>

      {open && (
        <div id="month-picker" className="mp-panel" role="dialog" aria-label="달 고르기">
          <div className="mp-year">
            <button
              type="button"
              onClick={() => setYear(year - 1)}
              disabled={year <= first.y}
              aria-label={`${year - 1}년`}
            >
              ‹
            </button>
            <b aria-live="polite">{year}년</b>
            <button
              type="button"
              onClick={() => setYear(year + 1)}
              disabled={year >= last.y}
              aria-label={`${year + 1}년`}
            >
              ›
            </button>
          </div>
          <ol className="mp-months">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const k = key({ y: year, m });
              const out = k < key(first) || k > key(last);
              const current = year === month.y && m === month.m;
              const now = year === thisMonth.y && m === thisMonth.m;
              return (
                <li key={m}>
                  <button
                    type="button"
                    disabled={out}
                    aria-current={current ? "date" : undefined}
                    className={now ? "mp-now" : undefined}
                    aria-label={`${year}년 ${m}월${now ? ", 이번 달" : ""}`}
                    onClick={() => go(m)}
                  >
                    {m}월
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
