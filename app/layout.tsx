import type { Metadata } from "next";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { Sidebar } from "@/components/Sidebar";
import { todayKr } from "@/lib/dates";
import { getBanners } from "@/lib/gametora";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "우마노트", template: "%s | 우마노트" },
  description: "우마무스메 한국서버 픽업·이벤트 일정, 뽑기 시뮬레이터, 사료계산기",
  appleWebApp: { title: "우마노트" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const today = todayKr();
  const banners = await getBanners();
  const live = banners.find((b) => b.lane === "train" && !b.paidOnly && b.start <= today && today <= b.end);
  const washStyle = live?.art ? ({ "--wash-img": `url(${live.art})` } as React.CSSProperties) : undefined;

  return (
    <html lang="ko">
      <body>
        <Suspense>
          <NavProgress />
        </Suspense>
        <div className="wash" style={washStyle} aria-hidden />
        <div className="app">
          <Sidebar />
          <main className="page">
            {children}
            <footer className="site-footer">
              우마노트는 비공식 사이트입니다. 게임 내 이미지·명칭 등 모든 저작권은 Cygames, Inc.에 있습니다.
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
