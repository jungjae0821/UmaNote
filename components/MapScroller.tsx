"use client";

import { useEffect, useRef } from "react";

// 노선도가 화면보다 넓을 때 처음에 '오늘' 선이 왼쪽 1/4쯤 오도록 스크롤한다
export function MapScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    const today = el?.querySelector<HTMLElement>(".today");
    if (!el || !today || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = today.offsetLeft - el.clientWidth * 0.25;
  }, []);

  return (
    // 좁은 화면에서 키보드 화살표로 가로 스크롤할 수 있도록 포커스를 받는다
    <section ref={ref} className="map" aria-label="픽업 노선도" tabIndex={0}>
      {children}
    </section>
  );
}
