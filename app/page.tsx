import { JewelSummary } from "@/components/JewelSummary";
import { LineMap } from "@/components/LineMap";
import { PickupColumn } from "@/components/PickupColumn";
import { formatLong, todayKr } from "@/lib/dates";
import { logFailure } from "@/lib/fetchJson";
import { getGachasBetween, type Gacha, type Lane } from "@/lib/umapyoi";

// 페이지를 통째로 1시간 캐시하면 자정 직후에도 어제 날짜가 보인다.
// 화면은 요청마다 그리고, 외부 API 응답만 데이터 캐시(1시간·24시간)에 둔다
export const dynamic = "force-dynamic";

// 노선도에 보여줄 범위: 오늘 기준 앞뒤 날 수. 진행 중 픽업이 더 일찍 시작했으면 MAX_BEFORE까지 늘린다
const BEFORE = 6;
const MAX_BEFORE = 45;
const AFTER = 34;

const LANES: Lane[] = ["train", "support"];

function nextOf(gachas: Gacha[], lane: Lane, today: number): Gacha[] {
  const upcoming = gachas.filter((g) => g.lane === lane && g.startKr > today);
  const first = Math.min(...upcoming.map((g) => g.startKr));
  return upcoming.filter((g) => g.startKr === first);
}

export default async function Home() {
  const today = todayKr();
  const to = today + AFTER;

  let gachas: Gacha[] | null = null;
  try {
    gachas = await getGachasBetween(today, to);
  } catch (err) {
    logFailure("홈 픽업 일정", err);
    gachas = null;
  }

  const live = gachas?.filter((g) => g.startKr <= today && today <= g.endKr) ?? [];
  const earliestLive = Math.min(today, ...live.map((g) => g.startKr));
  const from = Math.max(Math.min(today - BEFORE, earliestLive - 2), today - MAX_BEFORE);

  return (
    <main className="page home">
      <div className="home-head">
        <div>
          <h1>{formatLong(today)}</h1>
        </div>
        <div className="home-side">
          <JewelSummary />
          <ul className="legend" aria-label="노선 색">
            <li>
              <i className="lg-train" aria-hidden="true" />
              육성 우마무스메
            </li>
            <li>
              <i className="lg-support" aria-hidden="true" />
              서포트 카드
            </li>
          </ul>
        </div>
      </div>

      {gachas === null ? (
        <div className="notice" role="alert">
          <b>픽업 일정을 불러오지 못했어요.</b>
          <p>umapyoi.net에서 응답이 오지 않았어요. 잠시 뒤 새로고침해 주세요.</p>
        </div>
      ) : (
        <>
          <LineMap gachas={gachas} today={today} from={from} to={to} />
          <div className="home-grid">
            {LANES.map((lane) => (
              <PickupColumn
                key={lane}
                lane={lane}
                live={live.filter((g) => g.lane === lane)}
                next={nextOf(gachas, lane, today)}
                today={today}
                searchedUntil={to}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
