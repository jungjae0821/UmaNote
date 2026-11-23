import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Live } from "@/components/Live";
import { formatFull, formatMd, todayKr } from "@/lib/dates";
import { formatRate } from "@/lib/gachaPool";
import { cardIndex, getBanners, getCards, getCharacters, type Card } from "@/lib/gametora";
import "../characters.css";
import "./detail.css";

export const revalidate = 3600;

const SUPPORT_TYPE: Record<string, string> = {
  speed: "스피드",
  stamina: "스태미나",
  power: "파워",
  guts: "근성",
  intelligence: "지능",
  friend: "우정",
  group: "그룹",
};

async function findCard(id: string): Promise<Card | undefined> {
  const m = /^([ts])(\d+)$/.exec(id);
  if (!m) return undefined;
  const idx = cardIndex(await getCards());
  return idx.get(m[1] === "t" ? "train" : "support", Number(m[2]));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const card = await findCard((await params).id);
  return { title: card ? `${card.name} ${card.title}` : "캐릭터" };
}

export default async function CharacterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await findCard(id);
  if (!card) notFound();
  const today = todayKr();
  const [banners, characters] = await Promise.all([getBanners(), getCharacters()]);
  const appearances = banners.filter((b) => b.lane === card.lane && b.pickups.some((p) => p.card.id === card.id));
  const character = characters.find((c) => c.charId === card.charId);
  const firstUpcoming = appearances.find((b) => b.start > today);
  const rarity = card.lane === "train" ? `★${card.rarity}` : ["", "R", "SR", "SSR"][card.rarity];

  return (
    <>
      <div className="page-head">
        <Link href="/characters" className="aside-link">
          <Icon name="chevronLeft" />
          캐릭터 목록
        </Link>
      </div>
      <div className="cd">
        <div className="cd-art glass">
          <img src={card.art} alt={`${card.name} ${card.title}`} />
        </div>
        <div className="stack">
          <section>
            <p className="cd-title">{card.title}</p>
            <h1 className="cd-name">{card.name}</h1>
            <div className="tags-row cd-tags">
              <span className={`tag ${card.lane}`}>{card.lane === "train" ? "육성 우마무스메" : "서포트 카드"}</span>
              <span className="tag">{rarity}</span>
              {card.supportType && <span className="tag">{SUPPORT_TYPE[card.supportType]}</span>}
            </div>
          </section>
          <dl className="panel glass cd-facts">
            <div>
              <dt>한국서버 출시</dt>
              <dd>
                {card.releaseKr !== null && card.releaseKr <= today
                  ? formatFull(card.releaseKr)
                  : firstUpcoming
                    ? `${formatFull(firstUpcoming.start)} 예정`
                    : "아직 일정 없음"}
              </dd>
            </div>
            <div>
              <dt>생일</dt>
              <dd>{character ? `${character.birthMonth}월 ${character.birthDay}일` : "정보 없음"}</dd>
            </div>
          </dl>
          <section>
            <h2 className="section-title">나온 픽업</h2>
            {appearances.length === 0 ? (
              <p className="panel glass empty">한국서버 픽업 기록이 없습니다.</p>
            ) : (
              <ul className="panel glass cd-banners">
                {appearances
                  .slice()
                  .reverse()
                  .map((b) => {
                    const p = b.pickups.find((x) => x.card.id === card.id);
                    return (
                      <li key={b.id}>
                        <Link href={`/futures?banner=${b.id}`}>
                          <img src={b.art ?? card.art} alt="" loading="lazy" className={b.art ? undefined : "cd-noart"} />
                          <span className="cd-b-main">
                            <b>
                              {formatFull(b.start)} ~ {formatMd(b.end)}
                            </b>
                            <span className="tags-row">
                              {p?.isNew && <span className="tag">신규</span>}
                              {b.paidOnly && <span className="tag">유료 쥬얼 전용</span>}
                              {p && <span className="tag">{formatRate(p.rate)}</span>}
                            </span>
                          </span>
                          {b.end >= today && <Live start={b.start} end={b.end} today={today} />}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
