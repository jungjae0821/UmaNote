import Link from "next/link";
import { SkillCard } from "@/components/SkillCard";
import { statArt } from "@/lib/art";
import { getSkillsByJpName, type Skill } from "@/lib/cardDetail";
import type { Card } from "@/lib/gametora";
import { namuSkill, norm } from "@/lib/namuKo";
import data from "@/lib/data/mastersChallenge.json";

type Boss = {
  name: string;
  rank: string | null;
  stats: [string, number][];
  ground: string | null;
  dist: string | null;
  style: string | null;
  run: string | null;
  unique: [string, string] | null;
  skills: string[];
};
type Race = {
  name: string;
  level: string;
  year?: string;
  unlock?: string;
  track: string;
  ground: string;
  distance: number;
  dir: string;
  rivals: string[];
  boss: Boss;
};
type Edition = { n: number; scenario: string; races: Race[] };

const EDITIONS = data.editions as unknown as Edition[];
// 이 사이트 스킬 자료에 한국어가 없는 시나리오 스킬의 나무위키 번역
const SKILL_KO = data.skillKo as unknown as Record<string, [string, string]>;

export const mastersEdition = (n: number) => EDITIONS.find((e) => e.n === n);

const STATS = ["스피드", "스태미나", "파워", "근성", "지능"];
// 나무위키 그림 이름의 SSp·Ap는 SS+·A+
const gradeText = (g: string) => g.replace(/p$/, "+");

const cardHref = (c: Card) => `/characters/t${c.id}`;

/** "키타산 블랙 3차" → 그 캐릭터의 세 번째 의상 카드. 의상 카드가 없으면 첫 카드, 육성 미출시면 undefined */
function rivalCard(label: string, byName: Map<string, Card[]>): { name: string; card?: Card } {
  const m = /^(.+?) (\d)차$/.exec(label);
  const name = m ? m[1] : label;
  const cards = byName.get(name);
  if (!cards?.length) return { name };
  const nth = m ? Number(m[2]) : 1;
  const charId = cards[0].charId;
  return { name, card: cards.find((c) => c.id === charId * 100 + nth) ?? cards[0] };
}

/** 이 사이트의 스킬 자료가 기본. 한국어가 없으면 나무위키 번역, 그마저 없으면 일본어 원문 */
function skillOf(jp: string, byJp: Map<string, Skill>, ko?: string): Skill {
  const s = byJp.get(norm(jp));
  const local = SKILL_KO[jp];
  if (s && s.untranslated && local) return { ...s, name: local[0], desc: local[1], untranslated: false };
  if (s) return s.untranslated && ko ? { ...s, name: ko, untranslated: false } : s;
  const namu = local ?? namuSkill(jp);
  const name = ko ?? namu?.[0];
  return { id: 0, name: name ?? jp, desc: namu?.[1] ?? "", icon: "", rarity: 1, untranslated: !name };
}

function Aptitude({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mc-apt-row">
      <dt>{label}</dt>
      <dd>
        {value.split(", ").map((item) => {
          const [name, grade] = item.split(" ");
          return (
            <span key={name} className="mc-apt">
              {name}
              <b className={`grade grade-${grade.toLowerCase()}`}>{grade}</b>
            </span>
          );
        })}
      </dd>
    </div>
  );
}

function RaceCard({ race, byName, byJp }: { race: Race; byName: Map<string, Card[]>; byJp: Map<string, Skill> }) {
  const b = race.boss;
  const rivals = race.rivals.map((r) => rivalCard(r, byName));
  const unique = b.unique ? skillOf(b.unique[1], byJp, b.unique[0]) : undefined;
  const skills = b.skills.map((jp) => skillOf(jp, byJp));
  return (
    <article className="panel glass mc-race">
      <header className="mc-race-head">
        <h3>{race.name}</h3>
        <span className={`tag${race.level === "EX" ? " mc-ex" : ""}`}>LEVEL {race.level}</span>
        {race.year && /^\d+$/.test(race.year) && <span className="mc-year">{race.year}년</span>}
      </header>
      <p className="mc-cond">
        {race.track} · {race.ground} {race.distance}m · {race.dir}
      </p>
      {race.unlock && <p className="mc-unlock">{race.unlock}</p>}

      <ul className="mc-rivals" aria-label="출전 강적">
        {rivals.map((r, i) => {
          const face = r.card ? <img src={r.card.art} alt="" loading="lazy" /> : null;
          return (
            <li key={i} className={i === 0 ? "main" : undefined}>
              {r.card ? (
                <Link href={cardHref(r.card)} className="evd-face">
                  {face}
                </Link>
              ) : (
                <span className="evd-face" aria-hidden />
              )}
              <span className="mc-rival-name">
                {i === 0 && <span className="mc-role">메인</span>}
                {r.name}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mc-boss">
        <p className="mc-boss-title">
          <b>{b.name}</b>
          {b.rank && <span className="mc-rank">{b.rank}</span>}
          {b.run && <span className="tag">{b.run.split(" ")[0]}</span>}
        </p>
        {b.stats.length === 5 && (
          <dl className="evd-boss">
            {b.stats.map(([grade, v], s) => (
              <div key={s}>
                <dt>
                  <span className="stype" role="img" aria-label={STATS[s]} title={STATS[s]} style={{ backgroundImage: `url(${statArt(s)})` }} />
                  <span className="evd-stat-name">{STATS[s]}</span>
                </dt>
                <dd>
                  <span className="mc-grade">{gradeText(grade)}</span>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <dl className="mc-apts">
          <Aptitude label="경기장" value={b.ground} />
          <Aptitude label="거리" value={b.dist} />
          <Aptitude label="각질" value={b.style} />
        </dl>
        {unique && <SkillCard s={{ ...unique, rarity: 3 }} tag="고유" />}
        {skills.length > 0 && (
          <details className="mc-skills">
            <summary>소지 스킬 {skills.length}개</summary>
            <ul className="mc-skill-list">
              {skills.map((s, i) => (
                <li key={i}>
                  <SkillCard s={s} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

/** 마스터즈 챌린지 회차: 레이스별 조건과 강적 우마무스메 */
export async function MastersRaces({ edition, train }: { edition: Edition; train: Card[] }) {
  const byJp = await getSkillsByJpName().catch(() => new Map<string, Skill>());
  const byName = new Map<string, Card[]>();
  for (const c of train) byName.set(c.name, [...(byName.get(c.name) ?? []), c]);
  for (const list of byName.values()) list.sort((a, b) => a.id - b.id);

  return (
    <>
      <section>
        <h2 className="section-title">진행 방식</h2>
        <div className="panel glass mc-rules">
          <ul>
            <li>레이스마다 그해 우승마가 메인 강적, 함께 뛰었던 말이 서브 강적으로 나온다.</li>
            <li>LEVEL 1부터 1착을 해야 다음 레벨이 열린다. 아래 스펙은 LEVEL 3(또는 EX)의 메인 강적.</li>
            <li>한 우마무스메로는 같은 레벨에 승패와 상관없이 3번까지 도전할 수 있다.</li>
            <li>강적과 같은 우마무스메로 나가면 그 강적은 빠지고, 남은 강적의 스펙이 오른다.</li>
          </ul>
          <h3 className="mc-sub">레벨별 첫 클리어 보상</h3>
          <dl className="mc-rewards">
            <div>
              <dt>LEVEL 1</dt>
              <dd>쥬얼 300 · 금 결정 조각 1</dd>
            </div>
            <div>
              <dt>LEVEL 2</dt>
              <dd>쥬얼 300 · 무지개 결정 조각 1</dd>
            </div>
            <div>
              <dt>LEVEL 3</dt>
              <dd>쥬얼 300 · 트레이너 칭호</dd>
            </div>
          </dl>
          <p className="mc-scenario">대응 육성 시나리오 {edition.scenario}</p>
        </div>
      </section>
      <section>
        <h2 className="section-title">레이스와 강적</h2>
        <div className="mc-races">
          {edition.races.map((r, i) => (
            <RaceCard key={i} race={r} byName={byName} byJp={byJp} />
          ))}
        </div>
      </section>
    </>
  );
}
