import Link from "next/link";
import { Live } from "@/components/Live";
import { statArt } from "@/lib/art";
import { formatMdTime } from "@/lib/dates";
import type { Card, LegendRival } from "@/lib/gametora";

const STATS = ["스피드", "스태미나", "파워", "근성", "지능"];

const cardHref = (c: Card) => `/characters/${c.lane === "train" ? "t" : "s"}${c.id}`;

function Face({ card }: { card?: Card }) {
  if (!card) return <span className="evd-face" aria-hidden />;
  return (
    <Link href={cardHref(card)} className="evd-face">
      <img src={card.art} alt="" loading="lazy" />
    </Link>
  );
}

/** 레전드 레이스 상대: 열리는 기간과 능력치 */
export function LegendRivals({ rivals, today }: { rivals: LegendRival[]; today: number }) {
  return (
    <section>
      <h2 className="section-title">상대 레전드</h2>
      <div className="evd-rivals">
        {rivals.map((r, i) => (
          <article key={i} className="panel glass evd-rival">
            <div className="evd-rival-head">
              <Face card={r.card} />
              <div>
                {r.card && <span className="evd-card-title">[{r.card.title}]</span>}
                <b>{r.card?.name ?? "알 수 없음"}</b>
                <span className="ev-period">
                  {formatMdTime(r.startTs)} ~ {formatMdTime(r.endTs)}
                </span>
              </div>
              <Live start={r.start} end={r.end} today={today} />
            </div>
            {r.stats.length === 5 && (
              <dl className="evd-boss">
                {r.stats.map((v, s) => (
                  <div key={s}>
                    <dt>
                      <span className="stype" role="img" aria-label={STATS[s]} title={STATS[s]} style={{ backgroundImage: `url(${statArt(s)})` }} />
                      <span className="evd-stat-name">{STATS[s]}</span>
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
