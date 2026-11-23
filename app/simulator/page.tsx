import type { Metadata } from "next";
import Link from "next/link";
import { pickupLabel, toViewBanner } from "@/lib/bannerView";
import { formatFull, formatMd, todayKr } from "@/lib/dates";
import { buildPool } from "@/lib/gachaPool";
import { cardIndex, getBanners, getCards, type Lane } from "@/lib/gametora";
import { BannerSelect } from "./BannerSelect";
import { Simulator } from "./Simulator";
import "./simulator.css";

export const metadata: Metadata = { title: "뽑기 시뮬레이터" };
export const revalidate = 3600;

const LANES: { value: Lane; label: string }[] = [
  { value: "train", label: "육성 우마무스메" },
  { value: "support", label: "서포트 카드" },
];

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ lane?: string; banner?: string }> }) {
  const params = await searchParams;
  const lane: Lane = params.lane === "support" ? "support" : "train";
  const today = todayKr();
  const cards = await getCards();
  const idx = cardIndex(cards);
  const banners = (await getBanners(cards)).filter((b) => b.lane === lane && !b.paidOnly);
  const newest = banners.slice().reverse();
  const wanted = Number(params.banner);
  const selected =
    newest.find((b) => b.id === wanted) ??
    newest.find((b) => b.start <= today && today <= b.end) ??
    newest.find((b) => b.start <= today) ??
    newest[0];

  return (
    <>
      <div className="page-head">
        <h1>뽑기 시뮬레이터</h1>
      </div>
      <nav className="seg sim-tabs" aria-label="가챠 종류">
        {LANES.map((l) => (
          <Link key={l.value} href={`/simulator?lane=${l.value}`} aria-current={l.value === lane ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      {!selected ? (
        <p className="panel glass empty">gametora.com에서 배너 정보를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.</p>
      ) : (
        <>
          <BannerSelect
            lane={lane}
            selected={selected.id}
            options={newest.map((b) => {
              const v = toViewBanner(b);
              return { id: b.id, label: `${formatFull(b.start)} ~ ${formatMd(b.end)} · ${pickupLabel(v)}${b.estimated ? " (날짜 예상)" : ""}` };
            })}
          />
          <Simulator key={`${lane}-${selected.id}`} lane={lane} banner={toViewBanner(selected)} pool={buildPool(selected, idx.get)} today={today} />
        </>
      )}
    </>
  );
}
