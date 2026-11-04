import Link from "next/link";
import { Suspense } from "react";
import { Simulator } from "@/components/Simulator";
import { BannerPicker } from "@/components/BannerPicker";
import { todayKr } from "@/lib/dates";
import { logFailure } from "@/lib/fetchJson";
import { getSimData, type SimData } from "@/lib/gachaPool";
import type { Lane } from "@/lib/umapyoi";

export const metadata = { title: "뽑기 시뮬레이터 | 우마노트" };
export const revalidate = 3600;

const LANES: { value: Lane; label: string }[] = [
  { value: "train", label: "육성 우마무스메" },
  { value: "support", label: "서포트 카드" },
];

type Props = { searchParams: Promise<{ lane?: string; banner?: string }> };

export default async function SimulatorPage({ searchParams }: Props) {
  const params = await searchParams;
  const lane: Lane = params.lane === "support" ? "support" : "train";
  const bannerId = Number(params.banner) || null;
  const today = todayKr();

  return (
    <main className="page sim">
      <div className="sched-head">
        <div>
          <h1>뽑기 시뮬레이터</h1>
          <p className="sub">실제 배너의 카드별 제공 비율로 뽑아요. 쥬얼은 들지 않고, 기록은 이 브라우저에만 남아요.</p>
        </div>
        <nav className="seg" aria-label="가챠 종류">
          {LANES.map((l) => (
            <Link
              key={l.value}
              href={`/simulator?lane=${l.value}`}
              aria-current={l.value === lane ? "true" : undefined}
              className={`seg-${l.value}`}
            >
              <i aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* 탭이나 배너를 바꾸면 머리줄은 그대로 두고 배너 정보만 다시 불러온다 */}
      <Suspense
        key={`${lane}-${bannerId}`}
        fallback={
          <p className="notice" role="status">
            gametora.com에서 배너와 제공 비율을 불러오는 중이에요.
          </p>
        }
      >
        <SimBody lane={lane} bannerId={bannerId} today={today} />
      </Suspense>
    </main>
  );
}

async function SimBody({ lane, bannerId, today }: { lane: Lane; bannerId: number | null; today: number }) {
  let data: SimData | null = null;
  try {
    data = await getSimData(lane, bannerId, today);
  } catch (err) {
    logFailure("시뮬레이터 배너", err);
    data = null;
  }
  if (data === null || data.pool.length === 0) {
    return (
      <div className="notice" role="alert">
        <b>배너 정보를 불러오지 못했어요.</b>
        <p>gametora.com에서 응답이 오지 않았어요. 잠시 뒤 새로고침해 주세요.</p>
      </div>
    );
  }
  return (
    <>
      <BannerPicker lane={lane} banners={data.banners} selected={data.selected} today={today} />
      {/* 배너를 바꾸면 결과 화면을 새로 그린다 */}
      <Simulator
        key={`${lane}-${data.selected.id}`}
        lane={lane}
        banner={data.selected}
        image={data.image}
        pool={data.pool}
      />
    </>
  );
}
