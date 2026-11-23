import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { todayKr } from "@/lib/dates";
import { getBanners, getEvents } from "@/lib/gametora";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "우마노트", template: "%s | 우마노트" },
  description: "우마무스메 한국서버 픽업·이벤트 일정, 뽑기 시뮬레이터, 사료계산기",
};

// 처음 그리기 전에 저장된 테마를 적용한다. 기본은 다크
const THEME_SCRIPT = `try{var t=localStorage.getItem("umanote:theme:v1");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const today = todayKr();
  const [banners, events] = await Promise.all([getBanners(), getEvents()]);
  const live = banners.find((b) => b.lane === "train" && !b.paidOnly && b.start <= today && today <= b.end);
  const eventLive = events.some((e) => e.start <= today && today <= e.end);
  const washStyle = live?.art ? ({ "--wash-img": `url(${live.art})` } as React.CSSProperties) : undefined;

  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="wash" style={washStyle} aria-hidden />
        <div className="app">
          <Sidebar eventLive={eventLive} />
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
