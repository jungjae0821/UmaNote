"use client";

import { useState } from "react";
import type { BannerImage } from "@/lib/gachaPool";

// 두 이미지는 비율이 달라서(공지용 936×228, 게임 내 512×188) 지금 보여주는 쪽의 크기를 넘겨 자리를 미리 잡는다
const SIZE = { src: [936, 228], fallback: [512, 188] } as const;

/** 픽업 배너 이미지. 공지용 이미지가 없거나 못 불러오면 게임 내 배너로, 그것도 없으면 숨긴다 */
export function BannerArt({ image, alt }: { image: BannerImage; alt: string }) {
  const [which, setWhich] = useState<"src" | "fallback" | "none">(image.src ? "src" : "fallback");
  if (which === "none") return null;
  const [width, height] = SIZE[which];
  return (
    <img
      className={`banner-art banner-art-${which}`}
      src={which === "src" ? (image.src as string) : image.fallback}
      alt={alt}
      width={width}
      height={height}
      onError={() => setWhich(which === "src" ? "fallback" : "none")}
    />
  );
}
