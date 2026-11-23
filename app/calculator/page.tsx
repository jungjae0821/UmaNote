import type { Metadata } from "next";
import { toViewBanner } from "@/lib/bannerView";
import { SERVER_GAP_DAYS, todayKr } from "@/lib/dates";
import { getBanners, getCards, getEvents } from "@/lib/gametora";
import { competitionSchedule, getJewelIncomes } from "@/lib/jewelIncome";
import { Calculator } from "./Calculator";
import "./calculator.css";

export const metadata: Metadata = { title: "사료계산기" };
export const revalidate = 3600;


export default async function CalculatorPage() {
  const today = todayKr();
  // 목표로 고를 수 있는 범위: 지금 일본서버에서 진행 중인 픽업까지 (한국 예상일 = 일본 날짜 + 476일)
  const until = today + SERVER_GAP_DAYS;
  const cards = await getCards();
  const [banners, events, incomes] = await Promise.all([getBanners(cards, { jpProjection: true }), getEvents(cards), getJewelIncomes()]);
  const targets = banners.filter((b) => !b.paidOnly && b.start > today && b.start <= until && b.pickups.length > 0).map(toViewBanner);

  return (
    <>
      <div className="page-head">
        <h1>사료계산기</h1>
      </div>
      {targets.length === 0 ? (
        <p className="panel glass empty">gametora.com에서 앞으로의 픽업 일정을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.</p>
      ) : (
        <Calculator
          today={today}
          targets={targets}
          incomes={incomes.filter((i) => i.startKr > today && i.startKr <= until)}
          schedule={competitionSchedule(events).filter((s) => s.endKr > today && s.startKr <= until)}
        />
      )}
    </>
  );
}
