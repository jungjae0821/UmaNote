import { CardArt } from "@/components/CardArt";
import { formatDday, formatFull, formatShort } from "@/lib/dates";
import type { Gacha } from "@/lib/umapyoi";

const LANE_NAME = { train: "육성", support: "서포트" } as const;

function Status({ gacha, today }: { gacha: Gacha; today: number }) {
  if (gacha.endKr < today) return <span className="entry-status is-ended">종료</span>;
  if (gacha.startKr <= today) {
    const left = gacha.endKr - today;
    return (
      <span className="entry-status is-live" aria-label={`진행 중, 종료까지 ${left}일`}>
        진행 중 <b>{formatDday(left)}</b>
      </span>
    );
  }
  const until = gacha.startKr - today;
  return (
    <span className="entry-status is-next" aria-label={`시작까지 ${until}일`}>
      <b>{formatDday(until)}</b>
    </span>
  );
}

export function GachaEntry({ gacha, today }: { gacha: Gacha; today: number }) {
  const days = gacha.endKr - gacha.startKr + 1;
  return (
    <article className={`entry entry-${gacha.lane}`}>
      <header className="entry-head">
        <span className={`chip chip-${gacha.lane}`}>{LANE_NAME[gacha.lane]}</span>
        {gacha.paidOnly ? (
          <span className="chip chip-paid">유료 쥬얼</span>
        ) : (
          gacha.kind === "special" && <span className="chip chip-special">특별</span>
        )}
        <span className="entry-period">
          {formatShort(gacha.startKr)} – {formatShort(gacha.endKr)}
          <span className="entry-days">{days}일간</span>
          <small>
            일본 {formatFull(gacha.startJp)} – {formatShort(gacha.endJp)}
          </small>
        </span>
        <Status gacha={gacha} today={today} />
      </header>
      <ul className="entry-picks">
        {gacha.pickups.map((p) => (
          <li key={p.id} className="entry-pick">
            <CardArt lane={gacha.lane} src={p.art} fallback={p.thumb} />
            <div className="pick-text">
              <b>
                {p.name}
                {p.rarity && <span className="pick-rarity">{p.rarity}</span>}
                {p.supportType && (
                  <img
                    className="pick-type"
                    src={p.supportType.icon}
                    alt={`${p.supportType.label} 타입`}
                    title={`${p.supportType.label} 타입`}
                    width={18}
                    height={18}
                  />
                )}
              </b>
              {p.title && <span className="pick-title">{p.title}</span>}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
