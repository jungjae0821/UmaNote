"use client";

import { useEffect, useRef, useState } from "react";
import { formatMd } from "@/lib/dates";
import { Live } from "./Live";
import { useToday } from "@/lib/useToday";

export type HeroSlide = {
  id: string;
  kindName: string;
  name: string;
  start: number;
  end: number;
  /** 스토리 이벤트 일러스트(박스를 꽉 채운다) */
  art?: string;
  /** 공지 배너(936×228). 흐린 배경 위 가운데에 놓는다 */
  banner?: string;
  background?: string;
};

const INTERVAL = 3000;

/** 홈 이벤트 박스. 여러 개면 가로로 넘기고, 3초마다 다음 장으로 간다 */
export function HeroCarousel({ slides, today: serverToday }: { slides: HeroSlide[]; today: number }) {
  const today = useToday(serverToday);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;
  const many = slides.length > 1;

  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (!many || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) go((indexRef.current + 1) % slides.length);
    }, INTERVAL);
    return () => window.clearInterval(timer);
  }, [many, paused, slides.length]);

  return (
    <div
      className="hero-carousel"
      aria-roledescription={many ? "carousel" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        ref={track}
        className="hero-track"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {slides.map((s, i) => (
          <article
            key={s.id}
            className={`hero${s.banner ? " is-banner" : ""}`}
            style={s.background ? { background: s.background } : undefined}
            aria-roledescription={many ? "slide" : undefined}
            aria-label={many ? `${i + 1} / ${slides.length}` : undefined}
          >
            {s.art && (
              <img className="hero-art" src={s.art} alt={s.name} fetchPriority={i === 0 ? "high" : undefined} loading={i === 0 ? undefined : "lazy"} />
            )}
            {s.banner && (
              <>
                <img className="hero-bg" src={s.banner} alt="" aria-hidden loading={i === 0 ? undefined : "lazy"} />
                <img className="hero-banner" src={s.banner} alt={s.name} loading={i === 0 ? undefined : "lazy"} />
              </>
            )}
            <div className="hero-over">
              <div>
                <p className="hero-kind">
                  {s.kindName} · {formatMd(s.start)} ~ {formatMd(s.end)} · <Live start={s.start} end={s.end} today={today} dark />
                </p>
                <h3 className="hero-name">{s.name}</h3>
              </div>
            </div>
          </article>
        ))}
      </div>
      {many && (
        <div className="hero-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${s.kindName} 보기`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
