import type { Metadata } from "next";
import { Suspense } from "react";
import { toViewBanner } from "@/lib/bannerView";
import { todayKr } from "@/lib/dates";
import { getBanners } from "@/lib/gametora";
import { FuturesFromUrl } from "./FuturesFromUrl";
import { FuturesView } from "./FuturesView";

export const metadata: Metadata = { title: "미래시" };
export const revalidate = 3600;

export default async function FuturesPage() {
  const today = todayKr();
  const banners = (await getBanners()).map(toViewBanner);
  return (
    <>
      <div className="page-head">
        <h1>미래시</h1>
      </div>
      {/* 미리 만든 HTML에는 배너를 고르지 않은 화면이 들어가고, 브라우저에서 주소를 읽어 바꾼다 */}
      <Suspense fallback={<FuturesView banners={banners} today={today} initialBanner={null} />}>
        <FuturesFromUrl banners={banners} today={today} />
      </Suspense>
    </>
  );
}
