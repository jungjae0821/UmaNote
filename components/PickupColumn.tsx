import { CardArt } from "@/components/CardArt";
import { PickName } from "@/components/PickName";
import { formatDday, formatFull, formatShort } from "@/lib/dates";
import type { Gacha, Lane } from "@/lib/umapyoi";

type Props = {
  lane: Lane;
  live: Gacha[];
  /** 오늘 이후 가장 먼저 시작하는 픽업 (같은 날 시작하는 배너가 여럿이면 모두) */
  next: Gacha[];
  today: number;
  /** 다음 픽업을 찾아본 마지막 날 (한국서버 예상일) */
  searchedUntil: number;
};

const LANE_NAME: Record<Lane, string> = { train: "육성 우마무스메", support: "서포트 카드" };

function PickupRows({ gacha, today, mode }: { gacha: Gacha; today: number; mode: "live" | "next" }) {
  const diff = mode === "live" ? gacha.endKr - today : gacha.startKr - today;
  return (
    <>
      {gacha.pickups.map((p) => (
        <li key={`${gacha.id}-${p.id}`} className={`pick pick-${mode}`}>
          <CardArt lane={gacha.lane} src={p.art} fallback={p.thumb} />
          <div className="pick-text">
            <PickName pickup={p} />
            <span className="pick-title">{p.title}</span>
            <span className="pick-dates">
              {formatShort(gacha.startKr)} – {formatShort(gacha.endKr)}
              <small>
                일본 {formatFull(gacha.startJp)} – {formatShort(gacha.endJp)}
              </small>
            </span>
          </div>
          <span className="dday" aria-label={`${mode === "live" ? "종료" : "시작"}까지 ${diff}일`}>
            {formatDday(diff)}
            <small>{mode === "live" ? "종료까지" : "시작까지"}</small>
          </span>
        </li>
      ))}
    </>
  );
}

export function PickupColumn({ lane, live, next, today, searchedUntil }: Props) {
  const headId = `col-${lane}`;
  return (
    <section className={`box col col-${lane}`} aria-labelledby={headId}>
      <h2 id={headId} className="col-head">
        <i aria-hidden="true" />
        {LANE_NAME[lane]}
      </h2>

      <h3 className="col-sub">진행 중</h3>
      {live.length === 0 ? (
        <p className="empty">지금 진행 중인 픽업이 없어요.</p>
      ) : (
        <ul>
          {live.map((g) => (
            <PickupRows key={g.id} gacha={g} today={today} mode="live" />
          ))}
        </ul>
      )}

      <h3 className="col-sub">다음 픽업</h3>
      {next.length > 0 ? (
        <ul>
          {next.map((g) => (
            <PickupRows key={g.id} gacha={g} today={today} mode="next" />
          ))}
        </ul>
      ) : (
        <p className="empty">{formatShort(searchedUntil)}까지 예정된 픽업이 없어요.</p>
      )}
    </section>
  );
}
