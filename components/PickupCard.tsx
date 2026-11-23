import Link from "next/link";
import { formatRate } from "@/lib/gachaPool";
import type { Card } from "@/lib/gametora";

const RARITY = { train: ["", "★1", "★2", "★3"], support: ["", "R", "SR", "SSR"] } as const;

export function cardHref(c: Card) {
  return `/characters/${c.lane === "train" ? "t" : "s"}${c.id}`;
}

/** 몰루로그 학생 카드 크기의 세로 카드 */
export function PickupCard({
  card,
  rate,
  isNew,
  badge,
}: {
  card: Card;
  rate?: number;
  isNew?: boolean;
  badge?: string;
}) {
  const badgeText = badge ?? (card.lane === "support" ? RARITY.support[card.rarity] : undefined);
  return (
    <figure className="ccard">
      <Link href={cardHref(card)} className="art">
        <img src={card.art} alt="" loading="lazy" />
        {badgeText && <span className="badge">{badgeText}</span>}
      </Link>
      <small title={card.title}>
        {isNew && <em className="new">신규 </em>}
        {card.title}
      </small>
      <b>
        <Link href={cardHref(card)}>{card.name}</Link>
      </b>
      <div className="tags">
        <span className={`tag ${card.lane}`}>{card.lane === "train" ? "육성" : "서포트"}</span>
        {rate !== undefined && <span className="tag">{formatRate(rate)}</span>}
      </div>
    </figure>
  );
}
