import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Live } from "@/components/Live";
import { SUPPORT_TYPE_LABEL, SupportTypeIcon } from "@/components/SupportTypeIcon";
import { statArt } from "@/lib/art";
import { getCardDetail, type Effect, type Skill, type SupportDetail, type TrainDetail } from "@/lib/cardDetail";
import { formatFull, formatMd, todayKr } from "@/lib/dates";
import { formatRate } from "@/lib/gachaPool";
import { krRelease, releaseState } from "@/lib/release";
import { cardIndex, getBanners, getCards, getCharacters, getPredictedReleases, type Card } from "@/lib/gametora";
import "./detail.css";

export const revalidate = 3600;

// 카드마다 처음 요청될 때 만들어 두고 한 시간 동안 그대로 쓴다
export function generateStaticParams() {
  return [];
}

async function findCard(id: string, cards?: Card[]): Promise<Card | undefined> {
  const m = /^([ts])(\d+)$/.exec(id);
  if (!m) return undefined;
  const idx = cardIndex(cards ?? (await getCards()));
  return idx.get(m[1] === "t" ? "train" : "support", Number(m[2]));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const card = await findCard((await params).id);
  return { title: card ? `${card.name} ${card.title}` : "캐릭터" };
}

const STATS = ["스피드", "스태미나", "파워", "근성", "지능"];
const APTITUDE_GROUPS = [
  { title: "경기장", items: [[0, "잔디"], [1, "더트"]] },
  { title: "거리", items: [[2, "단거리"], [3, "마일"], [4, "중거리"], [5, "장거리"]] },
  { title: "각질", items: [[6, "도주"], [7, "선행"], [8, "선입"], [9, "추입"]] },
] as const;

function SkillList({ skills, label }: { skills: Skill[]; label?: (i: number) => string }) {
  if (skills.length === 0) return <p className="sk-none">없음</p>;
  return (
    <ul className="sk-list">
      {skills.map((s, i) => (
        <li key={`${s.id}-${i}`} className={`sk ${s.rarity >= 3 ? "sk-unique" : s.rarity === 2 ? "sk-gold" : ""}`}>
          <img src={s.icon} alt="" width={36} height={36} loading="lazy" />
          <div className="sk-main">
            <p className="sk-name">
              {label && <span className="tag">{label(i)}</span>}
              <b lang={s.untranslated ? "ja" : undefined}>{s.name}</b>
            </p>
            <p className="sk-desc" lang={s.untranslated ? "ja" : undefined}>
              {s.desc}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SkillGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sk-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function StatHead() {
  return (
    <tr>
      <th />
      {STATS.map((name, i) => (
        <th key={name} scope="col">
          <span className="stype" role="img" aria-label={name} title={name} style={{ backgroundImage: `url(${statArt(i)})` }} />
          <span className="cd-stat-name">{name}</span>
        </th>
      ))}
    </tr>
  );
}

function TrainSections({ d }: { d: TrainDetail }) {
  const hasUpgrade = d.unique.length > 1;
  return (
    <>
      <section>
        <h2 className="section-title">기본 능력치</h2>
        <div className="panel glass cd-scroll">
          <table className="cd-stats">
            <thead>
              <StatHead />
            </thead>
            <tbody>
              {d.stats.map((row) => (
                <tr key={row.star}>
                  <th scope="row">★{row.star}</th>
                  {row.values.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
              <tr className="cd-growth">
                <th scope="row">성장률</th>
                {d.growth.map((v, i) => (
                  <td key={i}>{v > 0 ? `+${v}%` : "–"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="section-title">적성</h2>
        <div className="panel glass cd-apt">
          {APTITUDE_GROUPS.map((g) => (
            <div key={g.title} className="cd-apt-row">
              <span className="cd-apt-title">{g.title}</span>
              <ul>
                {g.items.map(([i, name]) => {
                  const grade = d.aptitude[i] ?? "–";
                  return (
                    <li key={name}>
                      {name}
                      <b className={`grade grade-${grade.toLowerCase()}`}>{grade}</b>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="section-title">스킬</h2>
        <div className="panel glass sk-panel">
          <SkillGroup title="고유 스킬">
            <SkillList skills={d.unique} label={hasUpgrade ? (i) => (i === 0 ? "★1~2" : "★3 이상") : undefined} />
          </SkillGroup>
          <SkillGroup title="초기 스킬">
            <SkillList skills={d.innate} />
          </SkillGroup>
          <SkillGroup title="각성 스킬">
            <SkillList skills={d.awakening} label={(i) => `Lv${i + 2}`} />
          </SkillGroup>
          <SkillGroup title="이벤트에서 얻는 스킬">
            <SkillList skills={d.event} />
          </SkillGroup>
        </div>
      </section>
    </>
  );
}

function EffectList({ effects }: { effects: Effect[] }) {
  return (
    <dl className="cd-effects">
      {effects.map((e) => (
        <div key={e.name}>
          <dt>{e.name}</dt>
          <dd>{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SupportSections({ d }: { d: SupportDetail }) {
  const u = d.unique;
  return (
    <>
      <section>
        <h2 className="section-title">
          서포트 효과 <span className="tag">Lv{d.maxLevel} 기준</span>
        </h2>
        <div className="panel glass">
          <EffectList effects={d.effects} />
        </div>
      </section>
      {u && u.effects.length > 0 && (
        <section>
          <h2 className="section-title">
            고유 효과 {u.level > 1 && <span className="tag">Lv{u.level}부터</span>}
          </h2>
          <div className="panel glass">
            <EffectList effects={u.effects} />
            {u.hasConditional && <p className="cd-note">이 밖에 조건을 만족하면 발동하는 효과가 있습니다.</p>}
          </div>
        </section>
      )}
      <section>
        <h2 className="section-title">주는 스킬</h2>
        <div className="panel glass sk-panel">
          <SkillGroup title="힌트 스킬">
            <SkillList skills={d.hintSkills} />
          </SkillGroup>
          <SkillGroup title="이벤트에서 얻는 스킬">
            <SkillList skills={d.eventSkills} />
          </SkillGroup>
        </div>
      </section>
    </>
  );
}

export default async function CharacterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cards = await getCards();
  const card = await findCard(id, cards);
  if (!card) notFound();
  const today = todayKr();
  // 한국서버 일정이 끝난 뒤의 픽업도 보이도록 일본서버 배너를 +476일로 옮겨 붙인다
  const [banners, characters, detail, predicted] = await Promise.all([
    getBanners(cards, { jpProjection: true }),
    getCharacters(),
    getCardDetail(card.lane, card.id),
    getPredictedReleases(),
  ]);
  const appearances = banners.filter((b) => b.lane === card.lane && b.pickups.some((p) => p.card.id === card.id));
  const character = characters.find((c) => c.charId === card.charId);
  const kr = krRelease(card, banners);
  const state = releaseState(kr, today);
  // 출시일이 오면 '예정'을 떼고 첫 픽업이 끝날 때까지 '신규'. 일정이 없으면 gametora 예상일(일본서버 +476일, 나무위키와 같은 방식).
  // 예상일이 지났는데 한국 일정이 없으면 믿을 수 없어서 버린다
  const predictedDay = predicted.get(`${card.lane}:${card.id}`);
  const krDay = kr.day ?? (predictedDay !== undefined && predictedDay > today ? predictedDay : null);
  const krEstimated = kr.day === null || kr.estimated;
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
            <h1 className="cd-name">
              <SupportTypeIcon type={card.supportType} />
              {card.name}
            </h1>
            <div className="tags-row cd-tags">
              <span className={`tag ${card.lane}`}>{card.lane === "train" ? "육성 우마무스메" : "서포트 카드"}</span>
              <span className="tag">{rarity}</span>
              {card.supportType && <span className="tag">{SUPPORT_TYPE_LABEL[card.supportType]}</span>}
              {state === "new" && <span className="tag fresh">신규</span>}
            </div>
          </section>
          <dl className="panel glass cd-facts">
            <div>
              <dt>한국서버 출시</dt>
              <dd>
                {state !== "upcoming" ? (
                  formatFull(kr.day as number)
                ) : krDay !== null ? (
                  <>
                    {formatFull(krDay)} {krEstimated ? "예상" : "예정"}
                    <Live start={krDay} end={krDay} today={today} />
                  </>
                ) : (
                  "아직 일정 없음"
                )}
              </dd>
            </div>
            {card.releaseJp !== null && (
              <div>
                <dt>일본서버 출시</dt>
                <dd>{formatFull(card.releaseJp)}</dd>
              </div>
            )}
            <div>
              <dt>생일</dt>
              <dd>{character ? `${character.birthMonth}월 ${character.birthDay}일` : "정보 없음"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="stack cd-body">
        {detail?.lane === "train" && <TrainSections d={detail} />}
        {detail?.lane === "support" && <SupportSections d={detail} />}
        {!detail && <p className="panel glass empty">상세 정보를 불러오지 못했습니다.</p>}
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
                      {/* 일본서버에서 옮겨 온 배너는 미래시에 없어서 시뮬레이터로 보낸다 */}
                      <Link href={b.jpProjected ? `/simulator?lane=${b.lane}&banner=${b.id}` : `/futures?banner=${b.id}`}>
                        <img src={b.art ?? card.art} alt="" loading="lazy" className={b.art ? undefined : "cd-noart"} />
                        <span className="cd-b-main">
                          <b>
                            {formatFull(b.start)} ~ {formatMd(b.end)}
                          </b>
                          <span className="tags-row">
                            {b.estimated && <span className="tag">날짜 예상</span>}
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
    </>
  );
}
