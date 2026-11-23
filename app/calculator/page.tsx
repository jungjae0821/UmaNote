import type { Metadata } from "next";
import { toViewBanner } from "@/lib/bannerView";
import { todayKr } from "@/lib/dates";
import { getBanners, getCards, getEvents } from "@/lib/gametora";
import { competitionSchedule, getJewelIncomes } from "@/lib/jewelIncome";
import { Calculator } from "./Calculator";
import "./calculator.css";

export const metadata: Metadata = { title: "사료계산기" };
export const revalidate = 3600;

// 목표로 고를 수 있는 범위: 오늘부터 이 날 수 안에 시작하는 픽업
const RANGE_DAYS = 240;

export default async function CalculatorPage() {
  const today = todayKr();
  const until = today + RANGE_DAYS;
  const cards = await getCards();
  const [banners, events, incomes] = await Promise.all([getBanners(cards), getEvents(cards), getJewelIncomes()]);
  const targets = banners.filter((b) => b.start > today && b.start <= until && b.pickups.length > 0).map(toViewBanner);

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
