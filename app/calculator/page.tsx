import { Calculator } from "@/components/Calculator";
import { todayKr } from "@/lib/dates";
import { logFailure } from "@/lib/fetchJson";
import { getCompetitionSchedule, getJewelIncomes } from "@/lib/gametora";
import type { Scheduled } from "@/lib/jewelSources";
import type { Income } from "@/lib/jewelPlan";
import { getGachasBetween, type Gacha } from "@/lib/umapyoi";

export const metadata = { title: "사료계산기 | 우마노트" };
// 홈과 같은 이유로 날짜가 바뀌는 화면은 요청마다 그리고, 외부 응답만 데이터 캐시에 둔다
export const dynamic = "force-dynamic";

// 목표로 고를 수 있는 범위: 오늘부터 이 날 수 안에 시작하는 픽업
const RANGE_DAYS = 240;
const GACHA_LIMIT = 80;

export default async function CalculatorPage() {
  const today = todayKr();
  const until = today + RANGE_DAYS;

  const [gachas, incomes, schedule] = await Promise.all([
    getGachasBetween(today + 1, until, { special: true, limit: GACHA_LIMIT }).catch((err): Gacha[] | null => {
      logFailure("사료계산기 픽업 일정", err);
      return null;
    }),
    getJewelIncomes().catch((err): Income[] | null => {
      logFailure("사료계산기 보상", err);
      return null;
    }),
    // 대회 일정을 못 불러와도 나머지 계산은 그대로 보여준다
    getCompetitionSchedule().catch((err): Scheduled[] => {
      logFailure("사료계산기 대회 일정", err);
      return [];
    }),
  ]);

  return (
    <main className="page calc">
      <div className="sched-head">
        <div>
          <h1>사료계산기</h1>
        </div>
      </div>

      {gachas === null || incomes === null ? (
        <div className="notice" role="alert">
          <b>계산에 쓸 일정을 불러오지 못했어요.</b>
          <p>
            {gachas === null ? "umapyoi.net" : "gametora.com"}에서 응답이 오지 않았어요. 잠시 뒤 새로고침해 주세요.
          </p>
        </div>
      ) : (
        <Calculator
          today={today}
          gachas={gachas.filter((g) => g.startKr > today)}
          incomes={incomes.filter((i) => i.startKr > today && i.startKr <= until)}
          schedule={schedule.filter((s) => s.endKr > today && s.startKr <= until)}
        />
      )}
    </main>
  );
}
