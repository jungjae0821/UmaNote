"use client";

import { useSearchParams } from "next/navigation";
import type { ViewBanner } from "@/lib/bannerView";
import { FuturesView } from "./FuturesView";

/** ?banner=는 브라우저에서 읽는다. 서버가 주소를 읽으면 페이지를 미리 만들어 둘 수 없어서다 */
export function FuturesFromUrl({ banners, today }: { banners: ViewBanner[]; today: number }) {
  const param = useSearchParams().get("banner");
  const selected = param ? Number(param) : null;
  const initialBanner = Number.isFinite(selected) ? selected : null;
  return <FuturesView key={initialBanner ?? "none"} banners={banners} today={today} initialBanner={initialBanner} />;
}
