"use client";

import { useState } from "react";
import type { Lane } from "@/lib/umapyoi";

type Props = { lane: Lane; src: string; fallback: string };

// 의상·카드 일러스트를 못 불러오면 캐릭터 기본 초상으로 바꾼다
export function CardArt({ lane, src, fallback }: Props) {
  const [current, setCurrent] = useState(src);
  return (
    <img
      className={`art art-${lane}`}
      src={current}
      alt=""
      loading="lazy"
      onError={() => current !== fallback && setCurrent(fallback)}
    />
  );
}
