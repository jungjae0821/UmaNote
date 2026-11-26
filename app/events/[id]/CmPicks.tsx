import Link from "next/link";
import type { Card } from "@/lib/gametora";
import cmPicks from "@/lib/data/cmPicks.json";

type Entry = { article: number; picks: { card: number; style: string }[] };
const DATA = cmPicks.picks as Record<string, Entry>;

/** GameWith 챔미 공략의 추천 우마무스메. 일본서버 회차 ID로 찾는다 */
export function cmPicksOf(cmId: number): Entry | undefined {
  return DATA[cmId];
}

const cardHref = (c: Card) => `/characters/t${c.id}`;

export function CmPicks({ entry, train }: { entry: Entry; train: Map<number, Card> }) {
  const picks = entry.picks.flatMap((p) => {
    const card = train.get(p.card);
    return card ? [{ card, style: p.style }] : [];
  });
  if (!picks.length) return null;
  return (
    <section>
      <h2 className="section-title">추천 우마무스메</h2>
      <div className="evd-picks">
        {picks.map(({ card, style }) => (
          <Link key={card.id} href={cardHref(card)} className="panel glass evd-pick">
            <span className="evd-face">
              <img src={card.art} alt="" loading="lazy" />
            </span>
            <span className="evd-pick-text">
              <span className="evd-card-title">[{card.title}]</span>
              <b>{card.name}</b>
            </span>
            <span className="tag">{style}</span>
          </Link>
        ))}
      </div>
      <p className="evd-source">
        출처{" "}
        <a href={`${cmPicks.source}${entry.article}`} target="_blank" rel="noopener noreferrer">
          GameWith
        </a>
      </p>
    </section>
  );
}
