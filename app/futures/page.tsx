import type { Metadata } from "next";
import { toViewBanner } from "@/lib/bannerView";
import { todayKr } from "@/lib/dates";
import { getBanners } from "@/lib/gametora";
import { FuturesView } from "./FuturesView";

export const metadata: Metadata = { title: "미래시" };
export const revalidate = 3600;

export default async function FuturesPage({ searchParams }: { searchParams: Promise<{ banner?: string }> }) {
  const { banner } = await searchParams;
  const today = todayKr();
  const banners = (await getBanners()).map(toViewBanner);
  const selected = banner ? Number(banner) : null;
  return (
    <>
      <div className="page-head">
        <h1>미래시</h1>
      </div>
      <FuturesView banners={banners} today={today} initialBanner={Number.isFinite(selected) ? selected : null} />
    </>
  );
}
